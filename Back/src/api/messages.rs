use crate::{
    auth::AuthUser,
    db,
    models::{Message, Role},
    state::AppState,
    utils::{ApiError, ApiResult},
    ws::WsEvent,
};
use axum::{extract::{Path, Query, State}, routing::{delete, post}, Extension, Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: Message,
}

#[derive(Debug, Serialize)]
pub struct MessagesResponse {
    pub messages: Vec<Message>,
}

#[derive(Debug, Deserialize)]
pub struct Pagination {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/channels/:id/messages", post(send_message).get(list_messages))
        .route("/messages/:id", delete(delete_message))
}

pub async fn send_message(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<SendMessageRequest>,
) -> ApiResult<MessageResponse> {
    if payload.content.trim().is_empty() {
        return Err(ApiError::BadRequest("empty message".to_string()));
    }
    let channel = db::channels::get_by_id(&state.db, channel_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let role = db::members::get_role(&state.db, channel.server_id, user.user_id)
        .await?
        .ok_or(ApiError::Forbidden)?;
    if !role.allows(Role::Member) {
        return Err(ApiError::Forbidden);
    }
    let message = db::messages::create(&state.db, channel_id, user.user_id, &payload.content)
        .await?;
    state.ws_hub.broadcast_channel(
        channel_id,
        WsEvent::Message {
            message: message.clone(),
        },
    );
    state.ws_hub.broadcast_server(
        channel.server_id,
        WsEvent::Notification {
            server_id: channel.server_id,
            content: format!("New message in {}", channel.name),
        },
    );
    Ok(Json(MessageResponse { message }))
}

pub async fn list_messages(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
    Query(pagination): Query<Pagination>,
) -> ApiResult<MessagesResponse> {
    let channel = db::channels::get_by_id(&state.db, channel_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let role = db::members::get_role(&state.db, channel.server_id, user.user_id)
        .await?
        .ok_or(ApiError::Forbidden)?;
    if !role.allows(Role::Member) {
        return Err(ApiError::Forbidden);
    }
    let limit = pagination.limit.unwrap_or(50).clamp(1, 100);
    let offset = pagination.offset.unwrap_or(0).max(0);
    let messages = db::messages::list_for_channel(&state.db, channel_id, limit, offset).await?;
    Ok(Json(MessagesResponse { messages }))
}

pub async fn delete_message(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(message_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, ApiError> {
    let message = db::messages::get_by_id(&state.db, message_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let channel = db::channels::get_by_id(&state.db, message.channel_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let role = db::members::get_role(&state.db, channel.server_id, user.user_id)
        .await?
        .ok_or(ApiError::Forbidden)?;
    if message.author_id != user.user_id && !role.allows(Role::Admin) {
        return Err(ApiError::Forbidden);
    }
    db::messages::delete(&state.db, message_id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
