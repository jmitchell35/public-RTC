use crate::{db, models::Role, state::AppState, utils::ApiError, ws::WsEvent};
use uuid::Uuid;

/// Shared join logic: ban check → membership check → insert → broadcast.
pub async fn add_member_to_server(
    state: &AppState,
    server_id: Uuid,
    user_id: Uuid,
) -> Result<(), ApiError> {
    if db::bans::get_active_ban(&state.db, server_id, user_id).await?.is_some() {
        return Err(ApiError::Forbidden);
    }
    if db::members::get_role(&state.db, server_id, user_id).await?.is_some() {
        return Err(ApiError::Conflict("already a member".to_string()));
    }
    db::members::add_member(&state.db, server_id, user_id, Role::Member).await?;
    state.ws_hub.broadcast_server(server_id, WsEvent::ServerMembersUpdated { server_id });
    Ok(())
}

pub async fn ensure_member(
    state: &AppState,
    server_id: Uuid,
    user_id: Uuid,
) -> Result<Role, ApiError> {
    db::members::get_role(&state.db, server_id, user_id)
        .await?
        .ok_or(ApiError::Forbidden)
}

pub async fn ensure_role(
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
