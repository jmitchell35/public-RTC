use rtc_backend::{
    api,
    auth::JwtConfig,
    state::AppState,
    utils::config::Config,
    ws::handler::ws_handler,
};
use axum::{routing::get, Router};
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let config = Config::from_env();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(8))
        .idle_timeout(Duration::from_secs(120))
        .max_lifetime(Duration::from_secs(900))
        .test_before_acquire(true)
        .connect(&config.database_url)
        .await?;


    let jwt = JwtConfig::new(config.jwt_secret, config.jwt_exp_seconds);
    let state = AppState::new(pool, jwt);

    let api_router = api::router(state.clone());
    let ws_router = Router::new().route("/ws", get(ws_handler));

    let app = api_router
        .merge(ws_router)
        .with_state(state.clone())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    tracing::info!("listening on {}", config.bind_addr);
    axum::serve(listener, app).await?;

    Ok(())
}
