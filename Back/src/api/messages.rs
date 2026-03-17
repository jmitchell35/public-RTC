use crate::{
    auth::AuthUser,
    db,
    models::{Message, Role},
    state::AppState,
    utils::{ApiError, ApiResult},
    ws::WsEvent,
};
use axum::{extract::{Path, Query, State}, routing::{delete, post}, Extension, Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct EditMessageRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct ReactionRequest {
    pub emoji: String,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: Message,
}

#[derive(Debug, Serialize)]
pub struct MessagesResponse {
    pub messages: Vec<Message>,
}

#[derive(Debug, Serialize)]
pub struct ReactionsResponse {
    pub reactions: Vec<crate::models::MessageReaction>,
}

#[derive(Debug, Deserialize)]
pub struct Pagination {
    pub limit: Option<i64>,
    pub before: Option<String>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/channels/{id}/messages", post(send_message).get(list_messages))
        .route("/messages/{id}", delete(delete_message).put(edit_message))
        .route("/messages/{id}/pin", post(pin_message).delete(unpin_message))
        .route(
            "/messages/{id}/reactions",
            post(add_reaction).delete(remove_reaction).get(list_reactions),
        )
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
    let before: Option<DateTime<Utc>> = match pagination.before.as_deref() {
        Some(raw) => {
            let parsed = DateTime::parse_from_rfc3339(raw)
                .map_err(|_| ApiError::BadRequest("invalid before cursor".to_string()))?;
            Some(parsed.with_timezone(&Utc))
        }
        None => None,
    };
    let messages = db::messages::list_for_channel(&state.db, channel_id, limit, before).await?;
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
    state.ws_hub.broadcast_channel(
        message.channel_id,
        WsEvent::MessageDeleted {
            channel_id: message.channel_id,
            message_id,
        },
    );
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub async fn edit_message(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(message_id): Path<Uuid>,
    Json(payload): Json<EditMessageRequest>,
) -> ApiResult<MessageResponse> {
    if payload.content.trim().is_empty() {
        return Err(ApiError::BadRequest("empty message".to_string()));
    }
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
    let message = db::messages::update_content(&state.db, message_id, &payload.content)
        .await?
        .ok_or(ApiError::NotFound)?;
    state.ws_hub.broadcast_channel(
        channel.id,
        WsEvent::MessageUpdated { message: message.clone() },
    );
    Ok(Json(MessageResponse { message }))
}

pub async fn pin_message(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(message_id): Path<Uuid>,
) -> ApiResult<MessageResponse> {
    let message = db::messages::get_by_id(&state.db, message_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let channel = db::channels::get_by_id(&state.db, message.channel_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let role = db::members::get_role(&state.db, channel.server_id, user.user_id)
        .await?
        .ok_or(ApiError::Forbidden)?;
    if !role.allows(Role::Admin) {
        return Err(ApiError::Forbidden);
    }
    let message = db::messages::set_pinned(&state.db, message_id, true)
        .await?
        .ok_or(ApiError::NotFound)?;
    state.ws_hub.broadcast_channel(
        channel.id,
        WsEvent::MessagePinned { channel_id: channel.id, message_id, pinned: true },
    );
    Ok(Json(MessageResponse { message }))
}

pub async fn unpin_message(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(message_id): Path<Uuid>,
) -> ApiResult<MessageResponse> {
    let message = db::messages::get_by_id(&state.db, message_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let channel = db::channels::get_by_id(&state.db, message.channel_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let role = db::members::get_role(&state.db, channel.server_id, user.user_id)
        .await?
        .ok_or(ApiError::Forbidden)?;
    if !role.allows(Role::Admin) {
        return Err(ApiError::Forbidden);
    }
    let message = db::messages::set_pinned(&state.db, message_id, false)
        .await?
        .ok_or(ApiError::NotFound)?;
    state.ws_hub.broadcast_channel(
        channel.id,
        WsEvent::MessagePinned { channel_id: channel.id, message_id, pinned: false },
    );
    Ok(Json(MessageResponse { message }))
}

pub async fn add_reaction(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(message_id): Path<Uuid>,
    Json(payload): Json<ReactionRequest>,
) -> ApiResult<ReactionsResponse> {
    if payload.emoji.trim().is_empty() {
        return Err(ApiError::BadRequest("empty emoji".to_string()));
    }
    let message = db::messages::get_by_id(&state.db, message_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let channel = db::channels::get_by_id(&state.db, message.channel_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let role = db::members::get_role(&state.db, channel.server_id, user.user_id)
        .await?
        .ok_or(ApiError::Forbidden)?;
    if !role.allows(Role::Member) {
        return Err(ApiError::Forbidden);
    }
    let reaction = db::reactions::add(&state.db, message_id, user.user_id, &payload.emoji).await?;
    state.ws_hub.broadcast_channel(
        channel.id,
        WsEvent::ReactionAdded {
            channel_id: channel.id,
            message_id,
            reaction: reaction.clone(),
        },
    );
    let reactions = db::reactions::list_for_message(&state.db, message_id).await?;
    Ok(Json(ReactionsResponse { reactions }))
}

pub async fn remove_reaction(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(message_id): Path<Uuid>,
    Json(payload): Json<ReactionRequest>,
) -> ApiResult<ReactionsResponse> {
    let message = db::messages::get_by_id(&state.db, message_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let channel = db::channels::get_by_id(&state.db, message.channel_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let role = db::members::get_role(&state.db, channel.server_id, user.user_id)
        .await?
        .ok_or(ApiError::Forbidden)?;
    if !role.allows(Role::Member) {
        return Err(ApiError::Forbidden);
    }
    db::reactions::remove(&state.db, message_id, user.user_id, &payload.emoji).await?;
    state.ws_hub.broadcast_channel(
        channel.id,
        WsEvent::ReactionRemoved {
            channel_id: channel.id,
            message_id,
            user_id: user.user_id,
            emoji: payload.emoji.clone(),
        },
    );
    let reactions = db::reactions::list_for_message(&state.db, message_id).await?;
    Ok(Json(ReactionsResponse { reactions }))
}

pub async fn list_reactions(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(message_id): Path<Uuid>,
) -> ApiResult<ReactionsResponse> {
    let message = db::messages::get_by_id(&state.db, message_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let channel = db::channels::get_by_id(&state.db, message.channel_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let role = db::members::get_role(&state.db, channel.server_id, user.user_id)
        .await?
        .ok_or(ApiError::Forbidden)?;
    if !role.allows(Role::Member) {
        return Err(ApiError::Forbidden);
    }
    let reactions = db::reactions::list_for_message(&state.db, message_id).await?;
    Ok(Json(ReactionsResponse { reactions }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{auth::hash_password, db, state::AppState};
    use sqlx::PgPool;

    async fn setup_state() -> (AppState, PgPool) {
        dotenvy::dotenv().ok();
        let base_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set for api message tests");

        let schema = format!("test_{}", Uuid::new_v4().to_string().replace('-', "_"));
        let admin_pool = PgPool::connect(&base_url).await.expect("connect admin pool");
        sqlx::query(&format!("CREATE SCHEMA {}", schema))
            .execute(&admin_pool)
            .await
            .expect("create schema");

        let url_with_schema = with_search_path(&base_url, &schema);
        let pool = PgPool::connect(&url_with_schema).await.expect("connect test pool");
        db::run_migrations(&pool).await.expect("run migrations");

        let jwt = crate::auth::JwtConfig::new("test-secret".to_string(), 3600);
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

    async fn create_channel(pool: &PgPool, owner_id: Uuid) -> (crate::models::Server, crate::models::Channel) {
        let server = db::servers::create(pool, "Test Server", owner_id)
            .await
            .expect("create server");
        let channels = db::channels::list_for_server(pool, server.id)
            .await
            .expect("list channels");
        let channel = channels.first().expect("default channel").clone();
        (server, channel)
    }

    #[tokio::test]
    async fn edit_message_updates_content() {
        let (state, pool) = setup_state().await;
        let user = create_user(&pool, "alice", "alice@example.com").await;
        let (_server, channel) = create_channel(&pool, user.id).await;
        let message = db::messages::create(&pool, channel.id, user.id, "hello")
            .await
            .expect("create message");

        let res = edit_message(
            State(state),
            Extension(AuthUser { user_id: user.id }),
            Path(message.id),
            Json(EditMessageRequest { content: "edited".to_string() }),
        )
        .await
        .expect("edit message");

        assert_eq!(res.0.message.content, "edited");
        assert!(res.0.message.edited_at.is_some());
    }

    #[tokio::test]
    async fn pin_and_unpin_message() {
        let (state, pool) = setup_state().await;
        let user = create_user(&pool, "alice", "alice@example.com").await;
        let (_server, channel) = create_channel(&pool, user.id).await;
        let message = db::messages::create(&pool, channel.id, user.id, "hello")
            .await
            .expect("create message");

        let pinned = pin_message(
            State(state.clone()),
            Extension(AuthUser { user_id: user.id }),
            Path(message.id),
        )
        .await
        .expect("pin message");
        assert!(pinned.0.message.pinned);

        let unpinned = unpin_message(
            State(state),
            Extension(AuthUser { user_id: user.id }),
            Path(message.id),
        )
        .await
        .expect("unpin message");
        assert!(!unpinned.0.message.pinned);
    }

    #[tokio::test]
    async fn add_and_remove_reaction() {
        let (state, pool) = setup_state().await;
        let user = create_user(&pool, "alice", "alice@example.com").await;
        let (_server, channel) = create_channel(&pool, user.id).await;
        let message = db::messages::create(&pool, channel.id, user.id, "hello")
            .await
            .expect("create message");

        let res = add_reaction(
            State(state.clone()),
            Extension(AuthUser { user_id: user.id }),
            Path(message.id),
            Json(ReactionRequest { emoji: "👍".to_string() }),
        )
        .await
        .expect("add reaction");
        assert_eq!(res.0.reactions.len(), 1);

        let res = remove_reaction(
            State(state),
            Extension(AuthUser { user_id: user.id }),
            Path(message.id),
            Json(ReactionRequest { emoji: "👍".to_string() }),
        )
        .await
        .expect("remove reaction");
        assert!(res.0.reactions.is_empty());
    }
}
