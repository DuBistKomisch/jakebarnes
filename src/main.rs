#![feature(custom_derive)]
#![feature(plugin)]
#![plugin(rocket_codegen)]

extern crate base64;
extern crate chrono;
extern crate rocket;
extern crate rocket_contrib;
#[macro_use] extern crate serde_derive;

use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::str;

use chrono::prelude::*;

use rocket::request::Form;
use rocket::response::NamedFile;

use rocket_contrib::Template;

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
    let identity = data.get().identity.clone();
    let issuer = data.get().issuer.clone();
    let output = run_command("vipaccess provision -p -t VSMT | awk -F '[ :/?=&]' 'NR==2 { print $6; if ($7 == \"secret\") { print $8 } else { print $10 } }'")?;
    let output: Vec<_> = str::from_utf8(&output.stdout)?.split_whitespace().collect();
    let serial = String::from(*output.get(0).ok_or("no serial")?);
    let secret = String::from(*output.get(1).ok_or("no secret")?);
    let url = format!("otpauth://totp/{}?secret={}&issuer={}", identity, secret, issuer);
    let output = run_command(format!("qrencode -o - '{}'", url))?;
    let qr_code = base64::encode(&output.stdout);
    Ok(Template::render("paypal", PaypalContext { identity, issuer, serial, url, qr_code }))
}

// if nothing else matches, try loading a public file
#[get("/<file..>", rank = 1)]
fn public(file: PathBuf) -> Option<NamedFile> {
    NamedFile::open(Path::new("public/").join(file)).ok()
}

fn main() {
    rocket::ignite()
        .mount("/", routes![
             home,
             ds2sm,
             ds2sm_embed,
             kf,
             kf2,
             pd2,
             paypal,
             paypal_generate,
             public
        ])
        .attach(Template::fairing())
        .launch();
}
