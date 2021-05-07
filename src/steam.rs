use futures::stream::TryStreamExt;
use reqwest::{
    Response as ReqwestResponse,
    Result as ReqwestResult,
    Url,
    header
};
use rocket::{
    get,
    http::{ContentType, Status},
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
    io::{self, Cursor},
    pin::Pin
};
use thiserror::Error;
use tokio::io::AsyncRead;
use tokio_util::compat::FuturesAsyncReadCompatExt;

#[derive(Error, Debug)]
pub enum SteamError {
    #[error(transparent)]
    EnvVarError(#[from] env::VarError),

    #[error(transparent)]
    IoError(#[from] io::Error),

    #[error(transparent)]
    ReqwestError(#[from] reqwest::Error),

    #[error(transparent)]
    ReqwestToStrError(#[from] header::ToStrError),

    #[error(transparent)]
    UrlParseError(#[from] url::ParseError),
}

type SteamResult<T> = Result<T, SteamError>;

impl<'r> Responder<'r, 'static> for SteamError {
    fn respond_to(self, _: &'r Request<'_>) -> RocketResult<'static> {
        let description = self.to_string();
        RocketResponse::build()
            .status(Status::InternalServerError)
            .header(ContentType::Plain)
            .sized_body(None, Cursor::new(description))
            .ok()
    }
}

// translate response from reqwest to rocket

pub enum SteamResponse {
    Full {
        status: Status,
        content_type: ContentType,
        body: Pin<Box<dyn AsyncRead + Send>>
    },
    Status {
        status: Status
    }
}

impl TryFrom<ReqwestResult<ReqwestResponse>> for SteamResponse {
    type Error = SteamError;

    fn try_from(result: ReqwestResult<ReqwestResponse>) -> SteamResult<Self> {
        match result {
            Ok(response) => Self::try_from(response),
            Err(_) => Ok(Self::Status { status: Status::GatewayTimeout })
        }
    }
}

impl TryFrom<ReqwestResponse> for SteamResponse {
    type Error = SteamError;

    fn try_from(response: ReqwestResponse) -> SteamResult<Self> {
        let status = response.status().as_u16();
        let status = Status::from_code(status).unwrap_or(Status::Ok);
        let content_type = response.headers().get(header::CONTENT_TYPE)
            .map(|ct| ct.to_str()).transpose()?
            .and_then(|ct| ContentType::parse_flexible(ct))
            .unwrap_or(ContentType::JSON);
        // convert futures AsyncRead to tokio AsyncRead
        // https://github.com/benkay86/async-applied/tree/master/reqwest-tokio-compat
        let body = response.bytes_stream()
            .map_err(|e| futures::io::Error::new(futures::io::ErrorKind::Other, e))
            .into_async_read()
            .compat();
        let body = Box::pin(body);
        Ok(Self::Full { status, content_type, body })
    }
}

impl<'r> Responder<'r, 'static> for SteamResponse {
    fn respond_to(self, request: &'r Request<'_>) -> RocketResult<'static> {
        match self {
            Self::Full { status, content_type, body } => {
                RocketResponse::build()
                    .status(status)
                    .header(content_type)
                    .streamed_body(body)
                    .ok()
            },
            Self::Status { status } => status.respond_to(request)
        }
    }
}

// wrap steam api with reqwest

async fn steam_request(endpoint: &str, arguments: &[(&str, &str)]) -> SteamResult<SteamResponse> {
    let steam_api_key = env::var("STEAM_API_KEY")?;
    let url = format!("https://api.steampowered.com/{}?key={}", endpoint, steam_api_key);
    let url = Url::parse_with_params(&url, arguments)?;
    let result = reqwest::get(url).await;
    SteamResponse::try_from(result)
}

// routes

#[get("/resolve?<vanityurl>")]
pub async fn resolve(vanityurl: String) -> SteamResult<SteamResponse> {
    steam_request("ISteamUser/ResolveVanityURL/v0001", &[("vanityurl", &vanityurl)]).await
}

#[get("/stats/global?<gameid>")]
pub async fn stats_global(gameid: String) -> SteamResult<SteamResponse> {
    steam_request("ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002", &[("gameid", &gameid)]).await
}

#[get("/stats/schema?<appid>")]
pub async fn stats_schema(appid: String) -> SteamResult<SteamResponse> {
    steam_request("ISteamUserStats/GetSchemaForGame/v2", &[("appid", &appid)]).await
}

#[get("/stats/user?<appid>&<steamid>")]
pub async fn stats_user(appid: String, steamid: String) -> SteamResult<SteamResponse> {
    steam_request("ISteamUserStats/GetUserStatsForGame/v0002", &[("appid", &appid), ("steamid", &steamid)]).await
}
