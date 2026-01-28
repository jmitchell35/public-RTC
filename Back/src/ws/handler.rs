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

    for server_id in server_ids {
        state.presence.set_online(server_id, user_id, true);
        subscribe_server(&state.ws_hub, &out_tx, server_id, &mut server_tasks);
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
                subscribe_channel(&state.ws_hub, out_tx, channel_id, channel_tasks);
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
                subscribe_server(&state.ws_hub, out_tx, server_id, server_tasks);
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
