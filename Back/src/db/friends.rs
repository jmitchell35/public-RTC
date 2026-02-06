use crate::{models::UserPublic, utils::ApiError};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct FriendRequestRow {
    pub id: Uuid,
    pub requester_id: Uuid,
    pub addressee_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct FriendRequestWithUser {
    pub id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub friend_code: String,
    pub created_at: DateTime<Utc>,
}

pub async fn list_friends(pool: &PgPool, user_id: Uuid) -> Result<Vec<UserPublic>, ApiError> {
    let friends = sqlx::query_as::<_, UserPublic>(
        r#"SELECT u.id, u.username, u.friend_code
        FROM friends f
        JOIN users u ON u.id = f.friend_id
        WHERE f.user_id = $1
        ORDER BY u.username"#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(friends)
}

pub async fn list_incoming_requests(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<FriendRequestWithUser>, ApiError> {
    let requests = sqlx::query_as::<_, FriendRequestWithUser>(
        r#"SELECT fr.id, u.id as user_id, u.username, u.friend_code, fr.created_at
        FROM friend_requests fr
        JOIN users u ON u.id = fr.requester_id
        WHERE fr.addressee_id = $1
        ORDER BY fr.created_at DESC"#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(requests)
}

pub async fn list_outgoing_requests(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<FriendRequestWithUser>, ApiError> {
    let requests = sqlx::query_as::<_, FriendRequestWithUser>(
        r#"SELECT fr.id, u.id as user_id, u.username, u.friend_code, fr.created_at
        FROM friend_requests fr
        JOIN users u ON u.id = fr.addressee_id
        WHERE fr.requester_id = $1
        ORDER BY fr.created_at DESC"#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(requests)
}

pub async fn has_friendship(
    pool: &PgPool,
    user_id: Uuid,
    other_id: Uuid,
) -> Result<bool, ApiError> {
    let exists = sqlx::query_scalar::<_, i32>(
        r#"SELECT 1 FROM friends WHERE user_id = $1 AND friend_id = $2"#,
    )
    .bind(user_id)
    .bind(other_id)
    .fetch_optional(pool)
    .await?;
    Ok(exists.is_some())
}

pub async fn has_pending_request(
    pool: &PgPool,
    user_id: Uuid,
    other_id: Uuid,
) -> Result<bool, ApiError> {
    let exists = sqlx::query_scalar::<_, i32>(
        r#"SELECT 1
        FROM friend_requests
        WHERE (requester_id = $1 AND addressee_id = $2)
           OR (requester_id = $2 AND addressee_id = $1)"#,
    )
    .bind(user_id)
    .bind(other_id)
    .fetch_optional(pool)
    .await?;
    Ok(exists.is_some())
}

pub async fn create_request(
    pool: &PgPool,
    requester_id: Uuid,
    addressee_id: Uuid,
) -> Result<FriendRequestRow, ApiError> {
    let request_id = Uuid::new_v4();
    let request = sqlx::query_as::<_, FriendRequestRow>(
        r#"INSERT INTO friend_requests (id, requester_id, addressee_id)
        VALUES ($1, $2, $3)
        RETURNING id, requester_id, addressee_id, created_at"#,
    )
    .bind(request_id)
    .bind(requester_id)
    .bind(addressee_id)
    .fetch_one(pool)
    .await?;
    Ok(request)
}

pub async fn delete_request(
    pool: &PgPool,
    request_id: Uuid,
    user_id: Uuid,
) -> Result<(), ApiError> {
    let result = sqlx::query(
        r#"DELETE FROM friend_requests
        WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)"#,
    )
    .bind(request_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(())
}

pub async fn accept_request(
    pool: &PgPool,
    request_id: Uuid,
    user_id: Uuid,
) -> Result<Uuid, ApiError> {
    let mut tx = pool.begin().await?;
    let request = sqlx::query_as::<_, FriendRequestRow>(
        r#"SELECT id, requester_id, addressee_id, created_at
        FROM friend_requests
        WHERE id = $1"#,
    )
    .bind(request_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::NotFound)?;

    if request.addressee_id != user_id {
        return Err(ApiError::Forbidden);
    }

    sqlx::query(
        r#"INSERT INTO friends (user_id, friend_id)
        VALUES ($1, $2), ($2, $1)
        ON CONFLICT DO NOTHING"#,
    )
    .bind(request.requester_id)
    .bind(request.addressee_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(r#"DELETE FROM friend_requests WHERE id = $1"#)
        .bind(request_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(request.requester_id)
}
