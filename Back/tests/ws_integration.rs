use rtc_backend::{
    api,
    auth::{hash_password, JwtConfig},
    db,
    models::User,
    state::AppState,
    ws::{WsEvent, WsInbound},
};
use axum::{routing::get, Router};
use futures::{SinkExt, StreamExt};
use sqlx::PgPool;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio_tungstenite::connect_async;
use uuid::Uuid;

type WsStream = tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
>;

struct TestCtx {
    pool: PgPool,
    base_url: String,
    _server_task: tokio::task::JoinHandle<()>,
    jwt: JwtConfig,
}

async fn setup() -> TestCtx {
    dotenvy::dotenv().ok();
    let base_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set for WS tests");

    let schema = format!("test_{}", Uuid::new_v4().to_string().replace('-', "_"));
    let admin_pool = PgPool::connect(&base_url).await.expect("connect admin pool");
    sqlx::query(&format!("CREATE SCHEMA {}", schema))
        .execute(&admin_pool)
        .await
        .expect("create schema");

    let url_with_schema = with_search_path(&base_url, &schema);
    let pool = PgPool::connect(&url_with_schema).await.expect("connect test pool");
    db::run_migrations(&pool).await.expect("run migrations");

    let jwt = JwtConfig::new("test-secret".to_string(), 3600);
    let state = AppState::new(pool.clone(), jwt.clone());

    let api_router = api::router(state.clone());
    let ws_router = Router::new().route("/ws", get(rtc_backend::ws::handler::ws_handler));
    let app = api_router.merge(ws_router).with_state(state);

    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr = listener.local_addr().expect("local addr");

    let server_task = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    TestCtx {
        pool,
        base_url: format!("http://{}", addr),
        _server_task: server_task,
        jwt,
    }
}

fn with_search_path(base: &str, schema: &str) -> String {
    let sep = if base.contains('?') { '&' } else { '?' };
    format!("{base}{sep}options=-c%20search_path%3D{schema}")
}

async fn create_user(ctx: &TestCtx, username: &str, email: &str) -> User {
    let hash = hash_password("super_secret").expect("hash password");
    db::users::create(&ctx.pool, username, email, &hash)
        .await
        .expect("create user")
}

async fn issue_token(ctx: &TestCtx, user_id: Uuid) -> (String, rtc_backend::auth::Claims) {
    ctx.jwt.issue_token(user_id).expect("issue token")
}

async fn ws_connect(ctx: &TestCtx, token: &str) -> WsStream {
    let url = format!("{}/ws?token={}", ctx.base_url.replace("http", "ws"), token);
    let (ws, _) = connect_async(url).await.expect("ws connect");
    ws
}

async fn send_inbound(ws: &mut WsStream, inbound: WsInbound) {
    let text = serde_json::to_string(&inbound).expect("serialize inbound");
    ws.send(tokio_tungstenite::tungstenite::Message::Text(text))
        .await
        .expect("send inbound");
}

async fn recv_event(ws: &mut WsStream, timeout: Duration) -> WsEvent {
    let msg = tokio::time::timeout(timeout, ws.next())
        .await
        .expect("timeout")
        .expect("ws message")
        .expect("ws ok");
    match msg {
        tokio_tungstenite::tungstenite::Message::Text(text) => {
            serde_json::from_str(&text).expect("parse event")
        }
        other => panic!("unexpected ws message: {other:?}"),
    }
}

#[tokio::test]
async fn ws_rejects_missing_token() {
    let ctx = setup().await;
    let url = format!("{}/ws", ctx.base_url.replace("http", "ws"));
    let result = connect_async(url).await;
    assert!(result.is_err(), "connection without token should fail");
}

#[tokio::test]
async fn ws_ping_returns_pong_notification() {
    let ctx = setup().await;
    let user = create_user(&ctx, "alice", "alice@example.com").await;
    let (token, _claims) = issue_token(&ctx, user.id).await;

    let mut ws = ws_connect(&ctx, &token).await;
    send_inbound(&mut ws, WsInbound::Ping).await;

    let event = recv_event(&mut ws, Duration::from_secs(5)).await;
    match event {
        WsEvent::Notification { content, .. } => assert_eq!(content, "pong"),
        other => panic!("expected Notification pong, got {other:?}"),
    }
}

#[tokio::test]
async fn ws_rejects_revoked_token() {
    let ctx = setup().await;
    let user = create_user(&ctx, "alice", "alice@example.com").await;
    let (token, claims) = issue_token(&ctx, user.id).await;

    db::tokens::revoke(&ctx.pool, &claims.jti)
        .await
        .expect("revoke token");

    let url = format!("{}/ws?token={}", ctx.base_url.replace("http", "ws"), token);
    let result = connect_async(url).await;
    assert!(result.is_err(), "connection with revoked token should fail");
}
