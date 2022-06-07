use chrono::{Local, TimeZone};
use rocket::get;
use rocket_dyn_templates::Template;
use serde::Serialize;

const SECONDS_PER_YEAR: i64 = 31_557_600; // 365.25 * 24 * 60 * 60;

#[derive(Serialize)]
struct HomeContext {
    age: i64
}

#[get("/")]
pub fn get() -> Template {
    let age = Local::today().signed_duration_since(Local.ymd(1992, 8, 19)).num_seconds() / SECONDS_PER_YEAR;
    Template::render("home", HomeContext { age })
}
