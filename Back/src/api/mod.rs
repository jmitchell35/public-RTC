use crate::{auth as auth_core, state::AppState};
use axum::{middleware, routing::get, Router};

pub mod auth;
pub mod channels;
pub mod dm;
pub mod friends;
pub mod messages;
pub mod servers;
pub mod users;

pub fn router(state: AppState) -> Router<AppState> {
    let public = Router::new()
        .nest("/auth", auth::routes())
        .route("/health", get(health));

    let protected = Router::new()
        .route("/me", get(auth::me))
        .route("/me/status", axum::routing::post(auth::update_status))
        .route("/auth/logout", axum::routing::post(auth::logout))
        .merge(friends::routes())
        .merge(dm::routes())
        .merge(servers::routes())
        .merge(channels::routes())
        .merge(messages::routes())
        .merge(users::routes())
        .route_layer(middleware::from_fn_with_state(state.clone(), auth_core::auth_middleware));

    Router::new().merge(public).merge(protected)
}

async fn health() -> &'static str {
    "ok"
}
