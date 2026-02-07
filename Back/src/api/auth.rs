use crate::{
    auth::{extract_bearer_token, hash_password, verify_password, AuthUser},
    db,
    models::{UserPublic},
    state::AppState,
    utils::{validation, ApiError, ApiResult},
    ws::WsEvent,
};
use axum::{extract::State, http::HeaderMap, response::IntoResponse, routing::post, Extension, Json, Router};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct SignupRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub identifier: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserPublic,
}

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub user: UserPublic,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/signup", post(signup))
        .route("/login", post(login))
}

pub async fn signup(
    State(state): State<AppState>,
    Json(payload): Json<SignupRequest>,
) -> ApiResult<AuthResponse> {
    if !validation::validate_username(&payload.username) {
        return Err(ApiError::BadRequest("invalid username".to_string()));
    }
    if !validation::validate_password(&payload.password) {
        return Err(ApiError::BadRequest("password too short".to_string()));
    }

    let hash = hash_password(&payload.password)?;
    let user = db::users::create(&state.db, &payload.username, &payload.email, &hash).await?;
    db::users::set_status(&state.db, user.id, "online").await?;
    let (token, _) = state.jwt.issue_token(user.id)?;
    let user_public = UserPublic {
        id: user.id,
        username: user.username,
        friend_code: user.friend_code,
        status: "online".to_string(),
    };
    broadcast_status_update(&state, &user_public).await?;
    Ok(Json(AuthResponse {
        token,
        user: user_public,
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> ApiResult<AuthResponse> {
    let user = db::users::find_by_email_or_username(&state.db, &payload.identifier)
        .await?
        .ok_or(ApiError::Unauthorized)?;
    if !verify_password(&payload.password, &user.password_hash)? {
        return Err(ApiError::Unauthorized);
    }
    db::users::set_status(&state.db, user.id, "online").await?;
    let (token, _) = state.jwt.issue_token(user.id)?;
    let user_public = UserPublic {
        id: user.id,
        username: user.username,
        friend_code: user.friend_code,
        status: "online".to_string(),
    };
    broadcast_status_update(&state, &user_public).await?;
    Ok(Json(AuthResponse {
        token,
        user: user_public,
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
    Extension(_user): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let token = extract_bearer_token(&headers).ok_or(ApiError::Unauthorized)?;
    let claims = state.jwt.decode_token(&token)?;
    db::tokens::revoke(&state.db, &claims.jti).await?;
    db::users::set_status(&state.db, claims.sub, "offline").await?;
    let user = db::users::get_by_id(&state.db, claims.sub)
        .await?
        .ok_or(ApiError::NotFound)?;
    broadcast_status_update(&state, &UserPublic::from(&user)).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub async fn me(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
) -> ApiResult<MeResponse> {
    let user = db::users::get_by_id(&state.db, user.user_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(MeResponse {
        user: UserPublic::from(&user),
    }))
}

pub async fn update_status(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<UpdateStatusRequest>,
) -> ApiResult<MeResponse> {
    let status = payload.status.trim().to_lowercase();
    if !validation::validate_user_status(&status) {
        return Err(ApiError::BadRequest("invalid status".to_string()));
    }
    db::users::set_status(&state.db, user.user_id, &status).await?;
    let user = db::users::get_by_id(&state.db, user.user_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let user_public = UserPublic::from(&user);
    broadcast_status_update(&state, &user_public).await?;
    Ok(Json(MeResponse { user: user_public }))
}

impl SignupRequest {
    pub fn validate(&self) -> bool {
        validation::validate_username(&self.username) && validation::validate_password(&self.password)
    }
}

async fn broadcast_status_update(
    state: &AppState,
    user: &UserPublic,
) -> Result<(), ApiError> {
    let friend_ids = db::friends::list_friend_ids(&state.db, user.id).await?;
    for friend_id in friend_ids {
        state
            .ws_hub
            .broadcast_user(friend_id, WsEvent::FriendStatusUpdated { user: user.clone() });
    }
    state
        .ws_hub
        .broadcast_user(user.id, WsEvent::FriendStatusUpdated { user: user.clone() });
    let server_ids = db::members::list_server_ids_for_user(&state.db, user.id).await?;
    for server_id in server_ids {
        state
            .ws_hub
            .broadcast_server(server_id, WsEvent::ServerMembersUpdated { server_id });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signup_validation() {
        let req = SignupRequest {
            username: "al".to_string(),
            email: "a@b.com".to_string(),
            password: "short".to_string(),
        };
        assert!(!req.validate());
    }
}
