use crate::{
    auth::AuthUser,
    db,
    models::UserPublic,
    state::AppState,
    utils::{ApiError, ApiResult},
    ws::{FriendRequestPayload, WsEvent},
};
use axum::{
    extract::{Path, State},
    routing::{delete, get, post},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateFriendRequest {
    pub friend_code: String,
}

#[derive(Debug, Serialize)]
pub struct FriendsResponse {
    pub friends: Vec<UserPublic>,
}

#[derive(Debug, Serialize)]
pub struct FriendRequestItem {
    pub id: Uuid,
    pub user: UserPublic,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct FriendRequestsResponse {
    pub incoming: Vec<FriendRequestItem>,
    pub outgoing: Vec<FriendRequestItem>,
}

#[derive(Debug, Serialize)]
pub struct FriendRequestResponse {
    pub request: FriendRequestItem,
}

#[derive(Debug, Serialize)]
pub struct FriendResponse {
    pub friend: UserPublic,
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/friends", get(list_friends))
        .route("/friends/requests", get(list_requests).post(create_request))
        .route("/friends/requests/{id}/accept", post(accept_request))
        .route("/friends/requests/{id}", delete(delete_request))
}

pub async fn list_friends(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
) -> ApiResult<FriendsResponse> {
    let friends = db::friends::list_friends(&state.db, user.user_id).await?;
    Ok(Json(FriendsResponse { friends }))
}

pub async fn list_requests(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
) -> ApiResult<FriendRequestsResponse> {
    let incoming = db::friends::list_incoming_requests(&state.db, user.user_id).await?;
    let outgoing = db::friends::list_outgoing_requests(&state.db, user.user_id).await?;

    let incoming = incoming
        .into_iter()
        .map(|req| FriendRequestItem {
            id: req.id,
            user: UserPublic {
                id: req.user_id,
                username: req.username,
                friend_code: req.friend_code,
                status: req.status,
            },
            created_at: req.created_at,
        })
        .collect();

    let outgoing = outgoing
        .into_iter()
        .map(|req| FriendRequestItem {
            id: req.id,
            user: UserPublic {
                id: req.user_id,
                username: req.username,
                friend_code: req.friend_code,
                status: req.status,
            },
            created_at: req.created_at,
        })
        .collect();

    Ok(Json(FriendRequestsResponse { incoming, outgoing }))
}

pub async fn create_request(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<CreateFriendRequest>,
) -> ApiResult<FriendRequestResponse> {
    let friend_code = payload.friend_code.trim().to_lowercase();
    if friend_code.len() < 6 {
        return Err(ApiError::BadRequest("invalid friend code".to_string()));
    }

    let target = db::users::find_by_friend_code(&state.db, &friend_code)
        .await?
        .ok_or(ApiError::NotFound)?;

    if target.id == user.user_id {
        return Err(ApiError::BadRequest("cannot add yourself".to_string()));
    }

    if db::friends::has_friendship(&state.db, user.user_id, target.id).await? {
        return Err(ApiError::Conflict("already friends".to_string()));
    }

    if db::friends::has_pending_request(&state.db, user.user_id, target.id).await? {
        return Err(ApiError::Conflict("request already exists".to_string()));
    }

    let request = db::friends::create_request(&state.db, user.user_id, target.id).await?;
    let requester = db::users::get_by_id(&state.db, user.user_id)
        .await?
        .ok_or(ApiError::NotFound)?;

    let outgoing = FriendRequestPayload {
        id: request.id,
        user: UserPublic::from(&target),
        created_at: request.created_at,
    };
    let incoming = FriendRequestPayload {
        id: request.id,
        user: UserPublic::from(&requester),
        created_at: request.created_at,
    };

    state.ws_hub.broadcast_user(
        user.user_id,
        WsEvent::FriendRequestCreated {
            direction: "outgoing".to_string(),
            request: outgoing,
        },
    );
    state.ws_hub.broadcast_user(
        target.id,
        WsEvent::FriendRequestCreated {
            direction: "incoming".to_string(),
            request: incoming,
        },
    );

    Ok(Json(FriendRequestResponse {
        request: FriendRequestItem {
            id: request.id,
            user: UserPublic::from(&target),
            created_at: request.created_at,
        },
    }))
}

pub async fn accept_request(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(request_id): Path<Uuid>,
) -> ApiResult<FriendResponse> {
    let requester_id =
        db::friends::accept_request(&state.db, request_id, user.user_id).await?;
    let requester = db::users::get_by_id(&state.db, requester_id)
        .await?
        .ok_or(ApiError::NotFound)?;
    let acceptor = db::users::get_by_id(&state.db, user.user_id)
        .await?
        .ok_or(ApiError::NotFound)?;

    state.ws_hub.broadcast_user(
        requester.id,
        WsEvent::FriendRequestAccepted {
            request_id,
            friend: UserPublic::from(&acceptor),
        },
    );
    state.ws_hub.broadcast_user(
        acceptor.id,
        WsEvent::FriendRequestAccepted {
            request_id,
            friend: UserPublic::from(&requester),
        },
    );

    Ok(Json(FriendResponse {
        friend: UserPublic::from(&requester),
    }))
}

pub async fn delete_request(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(request_id): Path<Uuid>,
) -> Result<axum::http::StatusCode, ApiError> {
    let request = db::friends::delete_request(&state.db, request_id, user.user_id).await?;
    let other_id = if request.requester_id == user.user_id {
        request.addressee_id
    } else {
        request.requester_id
    };

    state.ws_hub.broadcast_user(
        user.user_id,
        WsEvent::FriendRequestRemoved { request_id },
    );
    state.ws_hub.broadcast_user(
        other_id,
        WsEvent::FriendRequestRemoved { request_id },
    );
    Ok(axum::http::StatusCode::NO_CONTENT)
}
