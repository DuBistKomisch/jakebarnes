use chrono::{Local, TimeZone};

use rocket_contrib::templates::Template;

#[derive(Serialize)]
struct HomeContext {
    age: i64
}

#[get("/")]
pub fn get() -> Template {
    let age = Local::today().signed_duration_since(Local.ymd(1992, 8, 19)).num_seconds() / 31557600;
    Template::render("home", HomeContext { age })
}
