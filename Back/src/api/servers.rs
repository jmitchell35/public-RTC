use crate::{
    auth::AuthUser,
    db,
    models::{MemberWithUser, Role, Server},
    state::AppState,
    utils::{validation, ApiError, ApiResult},
};
use axum::{extract::{Path, State}, routing::{delete, get, post, put}, Extension, Json, Router};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateServerRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateServerRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct JoinServerRequest {
    pub invite_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMemberRoleRequest {
    pub role: Role,
}

#[derive(Debug, Deserialize)]
pub struct CreateInviteRequest {
    pub expires_in_hours: Option<i64>,
    pub max_uses: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ServerResponse {
    pub server: Server,
}

#[derive(Debug, Serialize)]
pub struct ServersResponse {
    pub servers: Vec<Server>,
}

#[derive(Debug, Serialize)]
pub struct MembersResponse {
    pub members: Vec<MemberWithUser>,
}

#[derive(Debug, Serialize)]
pub struct InviteResponse {
    pub code: String,
    pub server_id: Uuid,
    pub expires_at: Option<chrono::DateTime<Utc>>,
    pub max_uses: Option<i32>,
    pub uses: i32,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/servers", post(create_server).get(list_servers))
        .route("/servers/{id}", get(get_server).put(update_server).delete(delete_server))
        .route("/server/{id}", get(get_server))
        .route("/servers/{id}/join", post(join_server))
        .route("/servers/{id}/leave", delete(leave_server))
        .route("/servers/{id}/members", get(list_members))
        .route("/servers/{id}/members/{user_id}", put(update_member_role))
        .route("/servers/{id}/invites", post(create_invite))
        .route("/invites/{code}/join", post(join_by_invite))
}

pub async fn create_server(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<CreateServerRequest>,
) -> ApiResult<ServerResponse> {
    if !validation::validate_server_name(&payload.name) {
        return Err(ApiError::BadRequest("invalid server name".to_string()));
    }
    let server = db::servers::create(&state.db, &payload.name, user.user_id).await?;
    Ok(Json(ServerResponse { server }))
}

pub async fn list_servers(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
) -> ApiResult<ServersResponse> {
    let servers = db::servers::list_for_user(&state.db, user.user_id).await?;
    Ok(Json(ServersResponse { servers }))
}

pub async fn get_server(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> ApiResult<ServerResponse> {
    ensure_member(&state, server_id, user.user_id).await?;
    let server = db::servers::get_by_id(&state.db, server_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(ServerResponse { server }))
}

pub async fn update_server(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<UpdateServerRequest>,
) -> ApiResult<ServerResponse> {
    ensure_role(&state, server_id, user.user_id, Role::Owner).await?;
    if !validation::validate_server_name(&payload.name) {
        return Err(ApiError::BadRequest("invalid server name".to_string()));
    }
    let server = db::servers::update_name(&state.db, server_id, &payload.name)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(ServerResponse { server }))
}

pub async fn delete_server(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, ApiError> {
    ensure_role(&state, server_id, user.user_id, Role::Owner).await?;
    db::servers::delete(&state.db, server_id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub async fn join_server(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<JoinServerRequest>,
) -> Result<axum::http::StatusCode, ApiError> {
    let code = payload.invite_code.ok_or(ApiError::BadRequest("invite code required".to_string()))?;
    let invite = db::invites::use_invite(&state.db, &code).await?;
    if invite.server_id != server_id {
        return Err(ApiError::BadRequest("invite does not match server".to_string()));
    }
    if db::members::get_role(&state.db, server_id, user.user_id).await?.is_some() {
        return Err(ApiError::Conflict("already a member".to_string()));
    }
    db::members::add_member(&state.db, server_id, user.user_id, Role::Member).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub async fn join_by_invite(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(code): Path<String>,
) -> Result<axum::http::StatusCode, ApiError> {
    let invite = db::invites::use_invite(&state.db, &code).await?;
    if db::members::get_role(&state.db, invite.server_id, user.user_id).await?.is_some() {
        return Err(ApiError::Conflict("already a member".to_string()));
    }
    db::members::add_member(&state.db, invite.server_id, user.user_id, Role::Member).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub async fn leave_server(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, ApiError> {
    let role = ensure_member(&state, server_id, user.user_id).await?;
    if role == Role::Owner {
        return Err(ApiError::BadRequest("owner cannot leave server".to_string()));
    }
    db::members::remove_member(&state.db, server_id, user.user_id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub async fn list_members(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
) -> ApiResult<MembersResponse> {
    ensure_member(&state, server_id, user.user_id).await?;
    let presence = state.presence.clone();
    let members = db::members::list_members_with_status(&state.db, server_id, |uid| {
        presence.is_online(server_id, uid)
    })
    .await?;
    Ok(Json(MembersResponse { members }))
}

pub async fn update_member_role(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path((server_id, target_user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateMemberRoleRequest>,
) -> Result<axum::http::StatusCode, ApiError> {
    ensure_role(&state, server_id, user.user_id, Role::Owner).await?;
    let target_role = db::members::get_role(&state.db, server_id, target_user_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    if payload.role == Role::Owner {
        if target_role == Role::Owner {
            return Ok(axum::http::StatusCode::NO_CONTENT);
        }
        db::members::transfer_ownership(&state.db, server_id, target_user_id, user.user_id).await?;
        return Ok(axum::http::StatusCode::NO_CONTENT);
    }
    db::members::update_role(&state.db, server_id, target_user_id, payload.role).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub async fn create_invite(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(server_id): Path<Uuid>,
    Json(payload): Json<CreateInviteRequest>,
) -> ApiResult<InviteResponse> {
    ensure_role(&state, server_id, user.user_id, Role::Admin).await?;
    let expires_at = payload
        .expires_in_hours
        .map(|hours| Utc::now() + Duration::hours(hours));
    let invite = db::invites::create(
        &state.db,
        server_id,
        user.user_id,
        expires_at,
        payload.max_uses,
    )
    .await?;
    Ok(Json(InviteResponse {
        code: invite.code,
        server_id: invite.server_id,
        expires_at: invite.expires_at,
        max_uses: invite.max_uses,
        uses: invite.uses,
    }))
}

async fn ensure_member(
    state: &AppState,
    server_id: Uuid,
    user_id: Uuid,
) -> Result<Role, ApiError> {
    db::members::get_role(&state.db, server_id, user_id)
        .await?
        .ok_or(ApiError::Forbidden)
}

async fn ensure_role(
    state: &AppState,
    server_id: Uuid,
    user_id: Uuid,
    required: Role,
) -> Result<Role, ApiError> {
    let role = ensure_member(state, server_id, user_id).await?;
    if !role.allows(required) {
        return Err(ApiError::Forbidden);
    }
    Ok(role)
}
