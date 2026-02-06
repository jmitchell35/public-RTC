use crate::{
    auth::AuthUser,
    db,
    models::{DirectMessage, UserPublic},
    state::AppState,
    utils::{ApiError, ApiResult},
    ws::WsEvent,
};
use axum::{
    extract::{Path, State},
    routing::get,
    Extension, Json, Router,
};
use serde::{Deserialize, Serialize};
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

pub fn routes() -> Router<AppState> {
    Router::new().route("/dm/{friend_id}", get(list_messages).post(send_message))
}

pub async fn list_messages(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(friend_id): Path<Uuid>,
) -> ApiResult<DirectMessagesResponse> {
    if friend_id == user.user_id {
        return Err(ApiError::BadRequest("invalid friend".to_string()));
    }

    if !db::friends::has_friendship(&state.db, user.user_id, friend_id).await? {
        return Err(ApiError::Forbidden);
    }

    let friend = db::users::get_by_id(&state.db, friend_id)
        .await?
        .ok_or(ApiError::NotFound)?;

    let conversation =
        db::direct_messages::get_conversation(&state.db, user.user_id, friend_id).await?;

    let messages = if let Some(conversation) = conversation {
        db::direct_messages::list_messages(&state.db, conversation.id).await?
    } else {
        Vec::new()
    };

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

    if !db::friends::has_friendship(&state.db, user.user_id, friend_id).await? {
        return Err(ApiError::Forbidden);
    }

    let friend = db::users::get_by_id(&state.db, friend_id)
        .await?
        .ok_or(ApiError::NotFound)?;

    let conversation =
        db::direct_messages::get_or_create_conversation(&state.db, user.user_id, friend_id)
            .await?;

    let message = db::direct_messages::create_message(
        &state.db,
        conversation.id,
        user.user_id,
        payload.content.trim(),
    )
    .await?;

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
