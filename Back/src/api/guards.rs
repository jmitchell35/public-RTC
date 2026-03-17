use crate::{db, models::Role, state::AppState, utils::ApiError};
use uuid::Uuid;

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
