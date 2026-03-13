use crate::{models::ServerBan, utils::ApiError};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn ban_user(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
    banned_by: Uuid,
    reason: Option<&str>,
    expires_at: Option<DateTime<Utc>>,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"INSERT INTO server_bans (server_id, user_id, banned_by, reason, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (server_id, user_id) DO UPDATE
            SET banned_by = EXCLUDED.banned_by,
                reason    = EXCLUDED.reason,
                expires_at = EXCLUDED.expires_at,
                created_at = NOW()"#,
    )
    .bind(server_id)
    .bind(user_id)
    .bind(banned_by)
    .bind(reason)
    .bind(expires_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn unban_user(pool: &PgPool, server_id: Uuid, user_id: Uuid) -> Result<(), ApiError> {
    sqlx::query("DELETE FROM server_bans WHERE server_id = $1 AND user_id = $2")
        .bind(server_id)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Returns the active ban (not expired) for a user on a server, if any.
pub async fn get_active_ban(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
) -> Result<Option<ServerBan>, ApiError> {
    let ban = sqlx::query_as::<_, ServerBan>(
        r#"SELECT server_id, user_id, banned_by, reason, expires_at, created_at
        FROM server_bans
        WHERE server_id = $1 AND user_id = $2
          AND (expires_at IS NULL OR expires_at > NOW())"#,
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    Ok(ban)
}
