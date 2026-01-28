use crate::utils::ApiError;
use sqlx::PgPool;

pub async fn revoke(pool: &PgPool, jti: &str) -> Result<(), ApiError> {
    sqlx::query("INSERT INTO revoked_tokens (jti) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(jti)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn is_revoked(pool: &PgPool, jti: &str) -> Result<bool, ApiError> {
    let exists: Option<i64> = sqlx::query_scalar(
        "SELECT 1 FROM revoked_tokens WHERE jti = $1",
    )
    .bind(jti)
    .fetch_optional(pool)
    .await?;
    Ok(exists.is_some())
}
