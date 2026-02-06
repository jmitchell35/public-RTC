use crate::{
    auth::AuthUser,
    db,
    models::{DirectMessage, UserPublic},
    state::AppState,
    utils::{ApiError, ApiResult},
    ws::WsEvent,
};
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Instant;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct SendDirectMessageRequest {
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct DirectMessagesResponse {
    pub friend: UserPublic,
    pub messages: Vec<DirectMessage>,
}

#[derive(Debug, Deserialize)]
pub struct DirectMessagesQuery {
    pub limit: Option<i64>,
    pub before: Option<String>,
}

pub fn routes() -> Router<AppState> {
    Router::new().route("/dm/{friend_id}", get(list_messages).post(send_message))
}

pub async fn list_messages(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(friend_id): Path<Uuid>,
    Query(query): Query<DirectMessagesQuery>,
) -> ApiResult<DirectMessagesResponse> {
    if friend_id == user.user_id {
        return Err(ApiError::BadRequest("invalid friend".to_string()));
    }

    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let before = match query.before.as_deref() {
        Some(raw) => {
            let parsed = DateTime::parse_from_rfc3339(raw)
                .map_err(|_| ApiError::BadRequest("invalid before cursor".to_string()))?;
            Some(parsed.with_timezone(&Utc))
        }
        None => None,
    };

    let started = Instant::now();
    let friend = db::friends::get_friend(&state.db, user.user_id, friend_id)
        .await?
        .ok_or(ApiError::Forbidden)?;
    log_db_timing("dm_friend_lookup", started, user.user_id, friend_id, None);

    let started = Instant::now();
    let messages = db::direct_messages::list_messages_for_users(
        &state.db,
        user.user_id,
        friend_id,
        limit,
        before,
    )
    .await?;
    log_db_timing(
        "dm_message_list",
        started,
        user.user_id,
        friend_id,
        Some(limit),
    );

    Ok(Json(DirectMessagesResponse {
        friend: UserPublic::from(&friend),
        messages,
    }))
}

pub async fn send_message(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(friend_id): Path<Uuid>,
    Json(payload): Json<SendDirectMessageRequest>,
) -> ApiResult<DirectMessagesResponse> {
    if payload.content.trim().is_empty() {
        return Err(ApiError::BadRequest("empty message".to_string()));
    }

    if friend_id == user.user_id {
        return Err(ApiError::BadRequest("invalid friend".to_string()));
    }

    let started = Instant::now();
    let friend = db::friends::get_friend(&state.db, user.user_id, friend_id)
        .await?
        .ok_or(ApiError::Forbidden)?;
    log_db_timing("dm_friend_lookup", started, user.user_id, friend_id, None);

    let started = Instant::now();
    let conversation =
        db::direct_messages::get_or_create_conversation(&state.db, user.user_id, friend_id)
            .await?;
    log_db_timing(
        "dm_conversation_upsert",
        started,
        user.user_id,
        friend_id,
        None,
    );

    let started = Instant::now();
    let message = db::direct_messages::create_message(
        &state.db,
        conversation.id,
        user.user_id,
        payload.content.trim(),
    )
    .await?;
    log_db_timing("dm_message_insert", started, user.user_id, friend_id, None);

    state.ws_hub.broadcast_user(
        user.user_id,
        WsEvent::DirectMessage {
            friend_id,
            message: message.clone(),
        },
    );
    state.ws_hub.broadcast_user(
        friend_id,
        WsEvent::DirectMessage {
            friend_id: user.user_id,
            message: message.clone(),
        },
    );

    let messages = vec![message.clone()];

    Ok(Json(DirectMessagesResponse {
        friend: UserPublic::from(&friend),
        messages,
    }))
}

fn log_db_timing(
    action: &'static str,
    started: Instant,
    user_id: Uuid,
    friend_id: Uuid,
    limit: Option<i64>,
) {
    let elapsed_ms = started.elapsed().as_millis() as u64;
    tracing::info!(
        target: "rtc_backend::timing",
        action,
        user_id = %user_id,
        friend_id = %friend_id,
        limit,
        elapsed_ms,
    );
}
