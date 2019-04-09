#![feature(proc_macro_hygiene, decl_macro)]

extern crate base64;
extern crate chrono;
#[macro_use] extern crate rocket;
extern crate rocket_contrib;
#[macro_use] extern crate serde_derive;
extern crate url;

use std::process::{Command, Output};
use std::str;

use chrono::prelude::*;

use rocket::request::Form;

use rocket_contrib::serve::{Options, StaticFiles};
use rocket_contrib::templates::Template;

use url::Url;

// home page
#[derive(Serialize)]
struct HomeContext {
    age: i64
}
#[get("/")]
fn home() -> Template {
    let age = Local::today().signed_duration_since(Local.ymd(1992, 8, 19)).num_seconds() / 31557600;
    Template::render("home", HomeContext { age })
}

#[get("/ds2sm")]
fn ds2sm() -> Template {
    Template::render("ds2sm", {})
}
#[get("/ds2sm/embed.html")]
fn ds2sm_embed() -> Template {
    Template::render("ds2sm_embed", {})
}

#[get("/kf")]
fn kf() -> Template {
    Template::render("kf", {})
}

#[get("/kf2")]
fn kf2() -> Template {
    Template::render("kf2", {})
}

#[get("/pattomobile")]
fn pattomobile() -> Template {
    Template::render("pattomobile", {})
}

#[get("/pd2")]
fn pd2() -> Template {
    Template::render("pd2", {})
}

// paypal 2fa
#[derive(FromForm)]
struct PaypalForm {
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
fn paypal() -> Template {
    Template::render("paypal", {})
}
#[post("/paypal", data = "<data>")]
fn paypal_generate(data: Form<PaypalForm>) -> Result<Template,Box<std::error::Error>> {
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

fn main() {
    rocket::ignite()
        .mount("/", routes![
             home,
             ds2sm,
             ds2sm_embed,
             kf,
             kf2,
             pattomobile,
             pd2,
             paypal,
             paypal_generate
        ])
        .mount("/", StaticFiles::new("public", Options::None))
        .attach(Template::fairing())
        .launch();
}
