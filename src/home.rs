use chrono::{Local, NaiveDate};
use rocket::get;
use rocket_dyn_templates::Template;
use serde::Serialize;

#[derive(Serialize)]
struct HomeContext {
    age: u32
}

#[get("/")]
pub fn get() -> Template {
    let age = Local::now().date_naive().years_since(NaiveDate::from_ymd_opt(1992, 8, 19).unwrap()).unwrap();
    Template::render("home", HomeContext { age })
}
