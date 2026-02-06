use crate::{
    auth::extract_bearer_token,
    db,
    models::{Role, UserPublic},
    state::AppState,
    utils::ApiError,
    ws::{WsEvent, WsHub, WsInbound},
};
use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Query, State},
    http::HeaderMap,
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use tokio::sync::{broadcast, mpsc};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct WsQuery {
    pub token: Option<String>,
}

pub async fn ws_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> Result<impl IntoResponse, ApiError> {
    let token = query.token.or_else(|| extract_bearer_token(&headers)).ok_or(ApiError::Unauthorized)?;
    let claims = state.jwt.decode_token(&token)?;
    if db::tokens::is_revoked(&state.db, &claims.jti).await? {
        return Err(ApiError::Unauthorized);
    }

    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state, claims.sub)))
}

async fn handle_socket(socket: WebSocket, state: AppState, user_id: Uuid) {
    let user = match db::users::get_by_id(&state.db, user_id).await {
        Ok(Some(user)) => user,
        _ => return,
    };
    let user_public = UserPublic::from(&user);

    let server_ids = db::members::list_server_ids_for_user(&state.db, user_id)
        .await
        .unwrap_or_default();

    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<WsEvent>();

    let send_task = tokio::spawn(async move {
        while let Some(event) = out_rx.recv().await {
            if let Ok(text) = serde_json::to_string(&event) {
                if ws_sender.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    let mut server_tasks = HashMap::new();
    let mut channel_tasks = HashMap::new();
    let mut subscribed_channels = HashSet::new();
    let user_task = subscribe_user(state.ws_hub.as_ref(), &out_tx, user_id);

    for server_id in server_ids {
        state.presence.set_online(server_id, user_id, true);
        subscribe_server(state.ws_hub.as_ref(), &out_tx, server_id, &mut server_tasks);
        state.ws_hub.broadcast_server(
            server_id,
            WsEvent::UserConnected {
                server_id,
                user: user_public.clone(),
            },
        );
    }

    while let Some(Ok(msg)) = ws_receiver.next().await {
        match msg {
            Message::Text(text) => {
                if let Ok(inbound) = serde_json::from_str::<WsInbound>(&text) {
                    handle_inbound(
                        inbound,
                        &state,
                        user_id,
                        &out_tx,
                        &mut server_tasks,
                        &mut channel_tasks,
                        &mut subscribed_channels,
                    )
                    .await;
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    for channel_id in &subscribed_channels {
        state.presence.set_typing(*channel_id, user_id, false);
        state.ws_hub.broadcast_channel(
            *channel_id,
            WsEvent::Typing {
                channel_id: *channel_id,
                user_id,
                is_typing: false,
            },
        );
    }

    let server_ids = db::members::list_server_ids_for_user(&state.db, user_id)
        .await
        .unwrap_or_default();
    for server_id in server_ids {
        state.presence.set_online(server_id, user_id, false);
        state.ws_hub.broadcast_server(
            server_id,
            WsEvent::UserDisconnected { server_id, user_id },
        );
    }

    drop(out_tx);
    for (_, task) in server_tasks {
        task.abort();
    }
    for (_, task) in channel_tasks {
        task.abort();
    }
    user_task.abort();
    send_task.abort();
}

async fn handle_inbound(
    inbound: WsInbound,
    state: &AppState,
    user_id: Uuid,
    out_tx: &mpsc::UnboundedSender<WsEvent>,
    server_tasks: &mut HashMap<Uuid, tokio::task::JoinHandle<()>>,
    channel_tasks: &mut HashMap<Uuid, tokio::task::JoinHandle<()>>,
    subscribed_channels: &mut HashSet<Uuid>,
) {
    match inbound {
        WsInbound::JoinChannel { channel_id } => {
            if subscribed_channels.insert(channel_id) {
                subscribe_channel(state.ws_hub.as_ref(), out_tx, channel_id, channel_tasks);
            }
        }
        WsInbound::LeaveChannel { channel_id } => {
            subscribed_channels.remove(&channel_id);
            if let Some(task) = channel_tasks.remove(&channel_id) {
                task.abort();
            }
        }
        WsInbound::SubscribeServer { server_id } => {
            let allowed = db::members::get_role(&state.db, server_id, user_id)
                .await
                .ok()
                .flatten()
                .is_some();
            if allowed {
                subscribe_server(state.ws_hub.as_ref(), out_tx, server_id, server_tasks);
            }
        }
        WsInbound::UnsubscribeServer { server_id } => {
            if let Some(task) = server_tasks.remove(&server_id) {
                task.abort();
            }
        }
        WsInbound::SendMessage { channel_id, content } => {
            if content.trim().is_empty() {
                return;
            }
            let channel = match db::channels::get_by_id(&state.db, channel_id).await {
                Ok(Some(channel)) => channel,
                _ => return,
            };
            let role = match db::members::get_role(&state.db, channel.server_id, user_id).await {
                Ok(Some(role)) => role,
                _ => return,
            };
            if !role.allows(Role::Member) {
                return;
            }
            if let Ok(message) = db::messages::create(&state.db, channel_id, user_id, &content).await
            {
                state.ws_hub.broadcast_channel(
                    channel_id,
                    WsEvent::Message { message: message.clone() },
                );
                state.ws_hub.broadcast_server(
                    channel.server_id,
                    WsEvent::Notification {
                        server_id: channel.server_id,
                        content: format!("New message in {}", channel.name),
                    },
                );
            }
        }
        WsInbound::Typing { channel_id, is_typing } => {
            state.presence.set_typing(channel_id, user_id, is_typing);
            state.ws_hub.broadcast_channel(
                channel_id,
                WsEvent::Typing {
                    channel_id,
                    user_id,
                    is_typing,
                },
            );
        }
        WsInbound::DirectTyping { friend_id, is_typing } => {
            state.ws_hub.broadcast_user(
                friend_id,
                WsEvent::DirectTyping {
                    friend_id: user_id,
                    is_typing,
                },
            );
        }
        WsInbound::Ping => {
            let _ = out_tx.send(WsEvent::Notification {
                server_id: Uuid::nil(),
                content: "pong".to_string(),
            });
        }
    }
}

fn spawn_forwarder(
    mut rx: broadcast::Receiver<WsEvent>,
    out_tx: mpsc::UnboundedSender<WsEvent>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(event) => {
                    let _ = out_tx.send(event);
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break,
            }
        }
    })
}

fn subscribe_channel(
    hub: &WsHub,
    out_tx: &mpsc::UnboundedSender<WsEvent>,
    channel_id: Uuid,
    tasks: &mut HashMap<Uuid, tokio::task::JoinHandle<()>>,
) {
    if tasks.contains_key(&channel_id) {
        return;
    }
    let rx = hub.channel_sender(channel_id).subscribe();
    let task = spawn_forwarder(rx, out_tx.clone());
    tasks.insert(channel_id, task);
}

fn subscribe_server(
    hub: &WsHub,
    out_tx: &mpsc::UnboundedSender<WsEvent>,
    server_id: Uuid,
    tasks: &mut HashMap<Uuid, tokio::task::JoinHandle<()>>,
) {
    if tasks.contains_key(&server_id) {
        return;
    }
    let rx = hub.server_sender(server_id).subscribe();
    let task = spawn_forwarder(rx, out_tx.clone());
    tasks.insert(server_id, task);
}

fn subscribe_user(
    hub: &WsHub,
    out_tx: &mpsc::UnboundedSender<WsEvent>,
    user_id: Uuid,
) -> tokio::task::JoinHandle<()> {
    let rx = hub.user_sender(user_id).subscribe();
    spawn_forwarder(rx, out_tx.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        auth::{hash_password, JwtConfig},
        db,
        state::AppState,
    };
    use sqlx::PgPool;
    use std::time::Duration;

    async fn setup_state() -> (AppState, PgPool) {
        dotenvy::dotenv().ok();
        let base_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set for WS handler tests");

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
        let state = AppState::new(pool.clone(), jwt);
        (state, pool)
    }

    fn with_search_path(base: &str, schema: &str) -> String {
        let sep = if base.contains('?') { '&' } else { '?' };
        format!("{base}{sep}options=-c%20search_path%3D{schema}")
    }

    async fn create_user(pool: &PgPool, username: &str, email: &str) -> crate::models::User {
        let hash = hash_password("super_secret").expect("hash password");
        db::users::create(pool, username, email, &hash)
            .await
            .expect("create user")
    }

    async fn create_server_and_channel(
        pool: &PgPool,
        owner_id: Uuid,
    ) -> (crate::models::Server, crate::models::Channel) {
        let server = db::servers::create(pool, "Test Server", owner_id)
            .await
            .expect("create server");
        let channels = db::channels::list_for_server(pool, server.id)
            .await
            .expect("list channels");
        let channel = channels.first().expect("default channel").clone();
        (server, channel)
    }

    async fn recv_event(rx: &mut mpsc::UnboundedReceiver<WsEvent>) -> WsEvent {
        tokio::time::timeout(Duration::from_secs(5), rx.recv())
            .await
            .expect("timeout")
            .expect("ws event")
    }

    #[tokio::test]
    async fn join_channel_and_send_message_emits_message_event() {
        let (state, pool) = setup_state().await;
        let user = create_user(&pool, "alice", "alice@example.com").await;
        let (_server, channel) = create_server_and_channel(&pool, user.id).await;

        let (out_tx, mut out_rx) = mpsc::unbounded_channel::<WsEvent>();
        let mut server_tasks = HashMap::new();
        let mut channel_tasks = HashMap::new();
        let mut subscribed_channels = HashSet::new();

        handle_inbound(
            WsInbound::JoinChannel { channel_id: channel.id },
            &state,
            user.id,
            &out_tx,
            &mut server_tasks,
            &mut channel_tasks,
            &mut subscribed_channels,
        )
        .await;

        handle_inbound(
            WsInbound::SendMessage {
                channel_id: channel.id,
                content: "hello".to_string(),
            },
            &state,
            user.id,
            &out_tx,
            &mut server_tasks,
            &mut channel_tasks,
            &mut subscribed_channels,
        )
        .await;

        let event = recv_event(&mut out_rx).await;
        match event {
            WsEvent::Message { message } => assert_eq!(message.content, "hello"),
            other => panic!("expected Message, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn typing_emits_typing_event() {
        let (state, pool) = setup_state().await;
        let user = create_user(&pool, "alice", "alice@example.com").await;
        let (_server, channel) = create_server_and_channel(&pool, user.id).await;

        let (out_tx, mut out_rx) = mpsc::unbounded_channel::<WsEvent>();
        let mut server_tasks = HashMap::new();
        let mut channel_tasks = HashMap::new();
        let mut subscribed_channels = HashSet::new();

        handle_inbound(
            WsInbound::JoinChannel { channel_id: channel.id },
            &state,
            user.id,
            &out_tx,
            &mut server_tasks,
            &mut channel_tasks,
            &mut subscribed_channels,
        )
        .await;

        handle_inbound(
            WsInbound::Typing {
                channel_id: channel.id,
                is_typing: true,
            },
            &state,
            user.id,
            &out_tx,
            &mut server_tasks,
            &mut channel_tasks,
            &mut subscribed_channels,
        )
        .await;

        let event = recv_event(&mut out_rx).await;
        match event {
            WsEvent::Typing { channel_id, is_typing, user_id } => {
                assert_eq!(channel_id, channel.id);
                assert_eq!(user_id, user.id);
                assert!(is_typing);
            }
            other => panic!("expected Typing, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn send_message_rejects_empty_content() {
        let (state, pool) = setup_state().await;
        let user = create_user(&pool, "alice", "alice@example.com").await;
        let (_server, channel) = create_server_and_channel(&pool, user.id).await;

        let (out_tx, mut out_rx) = mpsc::unbounded_channel::<WsEvent>();
        let mut server_tasks = HashMap::new();
        let mut channel_tasks = HashMap::new();
        let mut subscribed_channels = HashSet::new();

        handle_inbound(
            WsInbound::JoinChannel { channel_id: channel.id },
            &state,
            user.id,
            &out_tx,
            &mut server_tasks,
            &mut channel_tasks,
            &mut subscribed_channels,
        )
        .await;

        handle_inbound(
            WsInbound::SendMessage {
                channel_id: channel.id,
                content: "   ".to_string(),
            },
            &state,
            user.id,
            &out_tx,
            &mut server_tasks,
            &mut channel_tasks,
            &mut subscribed_channels,
        )
        .await;

        let maybe_event = tokio::time::timeout(Duration::from_millis(200), out_rx.recv()).await;
        assert!(maybe_event.is_err(), "no event should be emitted");
    }

    #[tokio::test]
    async fn subscribe_server_receives_notification() {
        let (state, pool) = setup_state().await;
        let user = create_user(&pool, "alice", "alice@example.com").await;
        let (server, _channel) = create_server_and_channel(&pool, user.id).await;

        let (out_tx, mut out_rx) = mpsc::unbounded_channel::<WsEvent>();
        let mut server_tasks = HashMap::new();
        let mut channel_tasks = HashMap::new();
        let mut subscribed_channels = HashSet::new();

        handle_inbound(
            WsInbound::SubscribeServer { server_id: server.id },
            &state,
            user.id,
            &out_tx,
            &mut server_tasks,
            &mut channel_tasks,
            &mut subscribed_channels,
        )
        .await;

        state.ws_hub.broadcast_server(
            server.id,
            WsEvent::Notification {
                server_id: server.id,
                content: "test".to_string(),
            },
        );

        let event = recv_event(&mut out_rx).await;
        match event {
            WsEvent::Notification { content, .. } => assert_eq!(content, "test"),
            other => panic!("expected Notification, got {other:?}"),
        }
    }
}
