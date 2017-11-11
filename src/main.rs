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

// load assets
#[get("/assets/<file..>")]
fn assets(file: PathBuf) -> Option<NamedFile> {
    NamedFile::open(Path::new("assets/").join(file)).ok()
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
             assets,
             public
        ])
        .attach(Template::fairing())
        .launch();
}
