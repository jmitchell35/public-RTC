use crate::{
    auth::{extract_bearer_token, hash_password, verify_password, AuthUser},
    db,
    models::{User, UserPublic},
    state::AppState,
    utils::{validation, ApiError, ApiResult},
    ws::WsEvent,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::get,
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub email: Option<String>,
    pub current_password: Option<String>,
    pub new_password: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub friend_code: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct UserProfileResponse {
    pub user: UserProfile,
}

pub fn routes() -> Router<AppState> {
    Router::new().route(
        "/users/{id}",
        get(get_profile).put(update_profile).delete(delete_profile),
    )
}

pub async fn get_profile(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(user_id): Path<Uuid>,
) -> ApiResult<UserProfileResponse> {
    if user.user_id != user_id {
        return Err(ApiError::Forbidden);
    }
    let user = db::users::get_by_id(&state.db, user_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(UserProfileResponse {
        user: UserProfile::from(&user),
    }))
}

pub async fn update_profile(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<UpdateProfileRequest>,
) -> ApiResult<UserProfileResponse> {
    if user.user_id != user_id {
        return Err(ApiError::Forbidden);
    }

    let username = normalize_optional(payload.username);
    if let Some(value) = username.as_deref() {
        if !validation::validate_username(value) {
            return Err(ApiError::BadRequest("invalid username".to_string()));
        }
    }

    let email = normalize_optional(payload.email);

    let new_password = normalize_optional(payload.new_password);
    let mut password_hash: Option<String> = None;
    if let Some(value) = new_password.as_deref() {
        if !validation::validate_password(value) {
            return Err(ApiError::BadRequest("password too short".to_string()));
        }
        let current_password = payload
            .current_password
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or(ApiError::BadRequest(
                "current password required".to_string(),
            ))?;
        let existing = db::users::get_by_id(&state.db, user.user_id)
            .await?
            .ok_or(ApiError::NotFound)?;
        if !verify_password(current_password, &existing.password_hash)? {
            return Err(ApiError::BadRequest("invalid current password".to_string()));
        }
        password_hash = Some(hash_password(value)?);
    }

    if username.is_none() && email.is_none() && password_hash.is_none() {
        return Err(ApiError::BadRequest("no changes".to_string()));
    }

    let updated = db::users::update_profile(
        &state.db,
        user.user_id,
        username.as_deref(),
        email.as_deref(),
        password_hash.as_deref(),
    )
    .await?
    .ok_or(ApiError::NotFound)?;

    let user_public = UserPublic::from(&updated);
    broadcast_profile_update(&state, &user_public).await?;

    Ok(Json(UserProfileResponse {
        user: UserProfile::from(&updated),
    }))
}

#[derive(Debug, Serialize)]
pub struct DeleteProfileResponse {
    pub deleted: bool,
}

pub async fn delete_profile(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(user_id): Path<Uuid>,
    headers: HeaderMap,
) -> ApiResult<DeleteProfileResponse> {
    if user.user_id != user_id {
        return Err(ApiError::Forbidden);
    }

    if let Some(token) = extract_bearer_token(&headers) {
        if let Ok(claims) = state.jwt.decode_token(&token) {
            let _ = db::tokens::revoke(&state.db, &claims.jti).await;
        }
    }

    let deleted = db::users::delete(&state.db, user_id).await?;
    if !deleted {
        return Err(ApiError::NotFound);
    }

    Ok(Json(DeleteProfileResponse { deleted: true }))
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

async fn broadcast_profile_update(
    state: &AppState,
    user: &UserPublic,
) -> Result<(), ApiError> {
    let friend_ids = db::friends::list_friend_ids(&state.db, user.id).await?;
    for friend_id in friend_ids {
        state.ws_hub.broadcast_user(
            friend_id,
            WsEvent::FriendStatusUpdated { user: user.clone() },
        );
    }
    state
        .ws_hub
        .broadcast_user(user.id, WsEvent::FriendStatusUpdated { user: user.clone() });
    Ok(())
}

impl From<&User> for UserProfile {
    fn from(user: &User) -> Self {
        Self {
            id: user.id,
            username: user.username.clone(),
            email: user.email.clone(),
            friend_code: user.friend_code.clone(),
            status: user.status.clone(),
            created_at: user.created_at,
        }
    }
}
