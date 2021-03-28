use rocket::{
    form::{Form, FromForm},
    get,
    http::{ContentType, Status},
    post,
    request::Request,
    response::{self, Redirect, Response, Responder}
};
use rocket_contrib::templates::Template;
use serde::Serialize;
use std::{
    io::{self, Cursor},
    process::Output,
    str
};
use thiserror::Error;
use tokio::process::Command;
use url::Url;

const TOKEN_MODELS: [&str; 2] = ["VSMT", "VSST"];

#[derive(Error, Debug)]
pub enum VipAccessError {
    #[error("command failed\ncommand: {0}\nstderr: {1}")]
    CommandFailed(String, String),

    #[error(transparent)]
    IOError(#[from] io::Error),

    #[error("no secret")]
    MissingSecret,

    #[error("no serial")]
    MissingSerial,

    #[error(transparent)]
    UrlParseError(#[from] url::ParseError),

    #[error(transparent)]
    Utf8Error(#[from] str::Utf8Error)
}

type VipAccessResult<T> = Result<T, VipAccessError>;

impl<'r> Responder<'r, 'static> for VipAccessError {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        let description = self.to_string();
        Response::build()
            .status(Status::InternalServerError)
            .header(ContentType::Plain)
            .sized_body(None, Cursor::new(description))
            .ok()
    }
}

#[derive(FromForm)]
pub struct VipAccessForm {
    identity: String,
    issuer: String,
    token_model: Option<String>
}

#[derive(Serialize)]
struct VipAccessSimpleContext {
    token_models: [&'static str; 2]
}

#[derive(Serialize)]
struct VipAccessFullContext {
    identity: String,
    issuer: String,
    serial: String,
    secret: String,
    token_model: String,
    token_models: [&'static str; 2],
    url: String,
    qr_code: String
}

async fn run_command<T: Into<String>>(command: T) -> VipAccessResult<Output> {
    let command = command.into();
    let output = Command::new("bash")
        .arg("-o")
        .arg("pipefail")
        .arg("-c")
        .arg(&command)
        .output()
        .await?;
    if !output.status.success() {
        return Err(VipAccessError::CommandFailed(command, str::from_utf8(&output.stderr)?.trim().to_string()))
    }
    Ok(output)
}

#[get("/paypal")]
pub fn paypal() -> Redirect {
    Redirect::to("/vipaccess")
}

#[get("/vipaccess")]
pub fn get() -> Template {
    Template::render("vipaccess",  VipAccessSimpleContext { token_models: TOKEN_MODELS })
}

#[post("/vipaccess", data = "<data>")]
pub async fn post(data: Form<VipAccessForm>) -> VipAccessResult<Template> {
    let identity = data.identity.clone();
    let issuer = data.issuer.clone();
    let token_model = data.token_model.clone().unwrap_or("VSMT".to_string());
    // provision into url
    let output = run_command(format!("vipaccess provision -p -t '{}' | grep otpauth", token_model)).await?;
    let mut url = Url::parse(str::from_utf8(&output.stdout)?.trim())?;
    // extract serial and secret from url
    let serial = String::from(url.path().split(':').next_back().ok_or(VipAccessError::MissingSerial)?);
    let secret = String::from(url.query_pairs().find(|(k, _v)| k == "secret").ok_or(VipAccessError::MissingSecret)?.1);
    // replace label in url
    url.set_path(&format!("/{}:{}", issuer, identity));
    // replace issuer in url
    let pairs: Vec<_> = url.query_pairs().into_owned().filter(|(k, _v)| k != "issuer").collect();
    url.query_pairs_mut().clear().extend_pairs(pairs).append_pair("issuer", &issuer);
    // qr encode url
    let url = url.into_string();
    let output = run_command(format!("qrencode -o - '{}'", url)).await?;
    let qr_code = base64::encode(&output.stdout);
    Ok(Template::render("vipaccess", VipAccessFullContext { identity, issuer, serial, secret, token_model, token_models: TOKEN_MODELS, url, qr_code }))
}
