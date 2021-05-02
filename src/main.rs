mod home;
mod vipaccess;
mod steam;

use rocket::{get, routes};
use rocket_contrib::{
    serve::{StaticFiles, crate_relative},
    templates::Template
};

#[get("/ds2sm")]
fn ds2sm() -> Template {
    Template::render("ds2sm", ())
}
#[get("/ds2sm/embed.html")]
fn ds2sm_embed() -> Template {
    Template::render("ds2sm_embed", ())
}

#[get("/kf")]
fn kf() -> Template {
    Template::render("kf", ())
}

#[get("/kf2")]
fn kf2() -> Template {
    Template::render("kf2", ())
}

#[get("/pattomobile")]
fn pattomobile() -> Template {
    Template::render("pattomobile", ())
}

#[get("/pd2")]
fn pd2() -> Template {
    Template::render("pd2", ())
}

#[get("/twenty")]
fn twenty() -> Template {
    Template::render("twenty", ())
}

#[rocket::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv::dotenv()?;

    rocket::build()
        .mount("/", routes![
            home::get,
            ds2sm,
            ds2sm_embed,
            kf,
            kf2,
            pattomobile,
            pd2,
            vipaccess::paypal,
            vipaccess::get,
            vipaccess::post,
            twenty
        ])
        .mount("/steam", routes![
            steam::resolve,
            steam::stats_global,
            steam::stats_schema,
            steam::stats_user
        ])
        .mount("/", StaticFiles::from(crate_relative!("public")))
        .attach(Template::fairing())
        .launch()
        .await?;

    Ok(())
}
