#![feature(proc_macro_hygiene, decl_macro)]

extern crate base64;
extern crate chrono;
#[macro_use] extern crate rocket;
extern crate rocket_contrib;
#[macro_use] extern crate serde_derive;
extern crate url;

mod home;
mod paypal;

use rocket_contrib::serve::{Options, StaticFiles};
use rocket_contrib::templates::Template;

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


fn main() {
    rocket::ignite()
        .mount("/", routes![
             home::get,
             ds2sm,
             ds2sm_embed,
             kf,
             kf2,
             pattomobile,
             pd2,
             paypal::get,
             paypal::post
        ])
        .mount("/", StaticFiles::new("public", Options::None))
        .attach(Template::fairing())
        .launch();
}
