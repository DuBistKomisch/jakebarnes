use rocket::request::Form;

use rocket_contrib::templates::Template;

use std::process::{Command, Output};
use std::str;

use url::Url;

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

fn run_command<T: Into<String>>(command: T) -> Result<Output,Box<std::error::Error>> {
    let command = command.into();
    let output = Command::new("bash")
        .arg("-o")
        .arg("pipefail")
        .arg("-c")
        .arg(&command)
        .output()?;
    if !output.status.success() {
        return Err(Box::from(format!("command failed: {}", &command)));
    }
    Ok(output)
}

#[get("/paypal")]
pub fn get() -> Template {
    Template::render("paypal", {})
}

#[post("/paypal", data = "<data>")]
pub fn post(data: Form<PaypalForm>) -> Result<Template,Box<std::error::Error>> {
    let identity = data.identity.clone();
    let issuer = data.issuer.clone();
    // provision into url
    let output = run_command("vipaccess provision -p -t VSMT | grep otpauth")?;
    let mut url = Url::parse(str::from_utf8(&output.stdout)?.trim())?;
    // extract serial and secret from url
    let serial = String::from(url.path().split(':').next_back().ok_or("no serial")?);
    let secret = String::from(url.query_pairs().find(|(k, _v)| k == "secret").ok_or("no secret")?.1);
    // replace label in url
    url.set_path(&format!("/{}:{}", issuer, identity));
    // replace issuer in url
    let pairs: Vec<_> = url.query_pairs().into_owned().filter(|(k, _v)| k != "issuer").collect();
    url.query_pairs_mut().clear().extend_pairs(pairs).append_pair("issuer", &issuer);
    // qr encode url
    let url = url.into_string();
    let output = run_command(format!("qrencode -o - '{}'", url))?;
    let qr_code = base64::encode(&output.stdout);
    Ok(Template::render("paypal", PaypalContext { identity, issuer, serial, secret, url, qr_code }))
}
