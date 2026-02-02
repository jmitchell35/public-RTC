use crate::{
    auth::AuthUser,
    db,
    models::{Channel, Role},
    state::AppState,
    utils::{validation, ApiError, ApiResult},
};
use axum::{extract::{Path, State}, routing::{get, post}, Extension, Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChannelRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct ChannelResponse {
    pub channel: Channel,
}

#[derive(Debug, Serialize)]
pub struct ChannelsResponse {
    pub channels: Vec<Channel>,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/servers/{server_id}/channels",
            post(create_channel).get(list_channels),
        )
        .route("/channels/{id}", get(get_channel).put(update_channel).delete(delete_channel))
}

pub async fn create_channel(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<CreateChannelRequest>,
) -> ApiResult<ChannelResponse> {
    ensure_role(&state, server_id, user.user_id, Role::Admin).await?;
    if !validation::validate_channel_name(&payload.name) {
        return Err(ApiError::BadRequest("invalid channel name".to_string()));
    }
    let channel = db::channels::create(&state.db, server_id, &payload.name).await?;
    Ok(Json(ChannelResponse { channel }))
}

pub async fn list_channels(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> ApiResult<ChannelsResponse> {
    ensure_role(&state, server_id, user.user_id, Role::Member).await?;
    let channels = db::channels::list_for_server(&state.db, server_id).await?;
    Ok(Json(ChannelsResponse { channels }))
}

pub async fn get_channel(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
) -> ApiResult<ChannelResponse> {
    let channel = db::channels::get_by_id(&state.db, channel_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    ensure_role(&state, channel.server_id, user.user_id, Role::Member).await?;
    Ok(Json(ChannelResponse { channel }))
}

pub async fn update_channel(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
    Json(payload): Json<UpdateChannelRequest>,
) -> ApiResult<ChannelResponse> {
    let channel = db::channels::get_by_id(&state.db, channel_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    ensure_role(&state, channel.server_id, user.user_id, Role::Admin).await?;
    if !validation::validate_channel_name(&payload.name) {
        return Err(ApiError::BadRequest("invalid channel name".to_string()));
    }
    let channel = db::channels::update_name(&state.db, channel_id, &payload.name)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(ChannelResponse { channel }))
}

pub async fn delete_channel(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(channel_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, ApiError> {
    let channel = db::channels::get_by_id(&state.db, channel_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    ensure_role(&state, channel.server_id, user.user_id, Role::Admin).await?;
    db::channels::delete(&state.db, channel_id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

async fn ensure_role(
    state: &AppState,
    server_id: Uuid,
    user_id: Uuid,
    required: Role,
) -> Result<Role, ApiError> {
    let role = db::members::get_role(&state.db, server_id, user_id)
        .await?
        .ok_or(ApiError::Forbidden)?;
    if !role.allows(required) {
        return Err(ApiError::Forbidden);
    }
    Ok(role)
}
