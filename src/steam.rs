use rocket::{
    get,
    http::{
        ContentType,
        Status
    },
    request::Request,
    response::{
        Responder,
        Response as RocketResponse,
        Result as RocketResult
    }
};
use std::{
    convert::TryFrom,
    env,
    error::Error,
    io::Cursor
};
use reqwest::{
    Response as ReqwestResponse,
    Result as ReqwestResult,
    Url,
    header
};

type LazyError = Box<dyn Error>;
type LazyResult<T> = Result<T, LazyError>;

// translate response from reqwest to rocket

#[derive(Debug)]
pub enum SteamResponse {
    Full {
        status: Status,
        content_type: ContentType,
        body: String
    },
    Status {
        status: Status
    }
}

impl TryFrom<ReqwestResult<ReqwestResponse>> for SteamResponse {
    type Error = LazyError;

    fn try_from(result: ReqwestResult<ReqwestResponse>) -> LazyResult<Self> {
        match result {
            Ok(response) => Self::try_from(response),
            Err(_) => Ok(Self::from(Status::GatewayTimeout))
        }
    }
}

impl TryFrom<ReqwestResponse> for SteamResponse {
    type Error = LazyError;

    fn try_from(mut response: ReqwestResponse) -> LazyResult<Self> {
        let status = response.status().as_u16();
        let status = Status::from_code(status).unwrap_or(Status::Ok);
        let content_type = response.headers().get(header::CONTENT_TYPE)
            .map(|ct| ct.to_str()).transpose()?
            .and_then(|ct| ContentType::parse_flexible(ct))
            .unwrap_or(ContentType::JSON);
        let body = response.text()?;
        Ok(Self::Full { status, content_type, body })
    }
}

impl From<Status> for SteamResponse {
    fn from(status: Status) -> Self {
        Self::Status { status }
    }
}

impl<'r> Responder<'r> for SteamResponse {
    fn respond_to(self, _: &Request) -> RocketResult<'r> {
        let mut response = RocketResponse::build();
        match self {
            Self::Full { status, content_type, body } => {
                response
                    .status(status)
                    .header(content_type)
                    .sized_body(Cursor::new(body));
            },
            Self::Status { status } => {
                response
                    .status(status);
            }
        }
        response.ok()
    }
}

// wrap steam api with reqwest

fn steam_request(endpoint: &str, arguments: &[(&str, &str)]) -> LazyResult<SteamResponse> {
    let steam_api_key = env::var("STEAM_API_KEY")?;
    let url = format!("https://api.steampowered.com/{}?key={}", endpoint, steam_api_key);
    let url = Url::parse_with_params(&url, arguments)?;
    let result = reqwest::get(url);
    SteamResponse::try_from(result)
}

// routes

#[get("/resolve?<vanityurl>")]
pub fn resolve(vanityurl: String) -> LazyResult<SteamResponse> {
    steam_request("ISteamUser/ResolveVanityURL/v0001", &[("vanityurl", &vanityurl)])
}

#[get("/stats/global?<gameid>")]
pub fn stats_global(gameid: String) -> LazyResult<SteamResponse> {
    steam_request("ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002", &[("gameid", &gameid)])
}

#[get("/stats/user?<appid>&<steamid>")]
pub fn stats_user(appid: String, steamid: String) -> LazyResult<SteamResponse> {
    steam_request("ISteamUserStats/GetUserStatsForGame/v0002", &[("appid", &appid), ("steamid", &steamid)])
}
