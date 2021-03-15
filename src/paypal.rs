use rocket::{
    form::{Form, FromForm},
    get,
    http::{ContentType, Status},
    post,
    request::Request,
    response::{self, Response, Responder}
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

#[derive(Error, Debug)]
pub enum PaypalError {
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

type PaypalResult<T> = Result<T, PaypalError>;

impl<'r> Responder<'r, 'static> for PaypalError {
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
pub struct PaypalForm {
    identity: String,
    issuer: String
}

#[derive(Serialize)]
struct PaypalContext {
    identity: String,
    issuer: String,
    serial: String,
    secret: String,
    url: String,
    qr_code: String
}

async fn run_command<T: Into<String>>(command: T) -> PaypalResult<Output> {
    let command = command.into();
    let output = Command::new("bash")
        .arg("-o")
        .arg("pipefail")
        .arg("-c")
        .arg(&command)
        .output()
        .await?;
    if !output.status.success() {
        return Err(PaypalError::CommandFailed(command, str::from_utf8(&output.stderr)?.trim().to_string()))
    }
    Ok(output)
}

#[get("/paypal")]
pub fn get() -> Template {
    Template::render("paypal", ())
}

#[post("/paypal", data = "<data>")]
pub async fn post(data: Form<PaypalForm>) -> PaypalResult<Template> {
    let identity = data.identity.clone();
    let issuer = data.issuer.clone();
    // provision into url
    let output = run_command("vipaccess provision -p -t VSMT | grep otpauth").await?;
    let mut url = Url::parse(str::from_utf8(&output.stdout)?.trim())?;
    // extract serial and secret from url
    let serial = String::from(url.path().split(':').next_back().ok_or(PaypalError::MissingSerial)?);
    let secret = String::from(url.query_pairs().find(|(k, _v)| k == "secret").ok_or(PaypalError::MissingSecret)?.1);
    // replace label in url
    url.set_path(&format!("/{}:{}", issuer, identity));
    // replace issuer in url
    let pairs: Vec<_> = url.query_pairs().into_owned().filter(|(k, _v)| k != "issuer").collect();
    url.query_pairs_mut().clear().extend_pairs(pairs).append_pair("issuer", &issuer);
    // qr encode url
    let url = url.into_string();
    let output = run_command(format!("qrencode -o - '{}'", url)).await?;
    let qr_code = base64::encode(&output.stdout);
    Ok(Template::render("paypal", PaypalContext { identity, issuer, serial, secret, url, qr_code }))
}
