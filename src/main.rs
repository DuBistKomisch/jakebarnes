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
             public
        ])
        .attach(Template::fairing())
        .launch();
}
