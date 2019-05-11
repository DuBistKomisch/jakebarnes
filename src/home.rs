use chrono::{Local, TimeZone};
use rocket::get;
use rocket_contrib::templates::Template;
use serde::Serialize;

#[derive(Serialize)]
struct HomeContext {
    age: i64
}

#[get("/")]
pub fn get() -> Template {
    let age = Local::today().signed_duration_since(Local.ymd(1992, 8, 19)).num_seconds() / 31557600;
    Template::render("home", HomeContext { age })
}
