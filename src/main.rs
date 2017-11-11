#![feature(plugin)]
#![plugin(rocket_codegen)]

extern crate chrono;
extern crate rocket;
extern crate rocket_contrib;
#[macro_use] extern crate serde_derive;

use std::path::{Path, PathBuf};

use chrono::prelude::*;

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

#[get("/kf")]
fn kf() -> Template {
    Template::render("kf", {})
}

#[get("/kf2")]
fn kf2() -> Template {
    Template::render("kf2", {})
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
             kf,
             kf2,
             public
        ])
        .attach(Template::fairing())
        .launch();
}
