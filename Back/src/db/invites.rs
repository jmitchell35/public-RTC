use crate::{models::Invite, utils::ApiError};
use chrono::{DateTime, Utc};
use rand::{distributions::Alphanumeric, Rng};
use sqlx::PgPool;
use uuid::Uuid;

pub fn generate_code() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(10)
        .map(char::from)
        .collect()
}

pub async fn create(
    pool: &PgPool,
    server_id: Uuid,
    created_by: Uuid,
    expires_at: Option<DateTime<Utc>>,
    max_uses: Option<i32>,
) -> Result<Invite, ApiError> {
    let code = generate_code();
    let invite = sqlx::query_as::<_, Invite>(
        r#"INSERT INTO invites (code, server_id, created_by, expires_at, max_uses)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING code, server_id, created_by, created_at, expires_at, max_uses, uses"#,
    )
    .bind(&code)
    .bind(server_id)
    .bind(created_by)
    .bind(expires_at)
    .bind(max_uses)
    .fetch_one(pool)
    .await?;
    Ok(invite)
}

pub async fn get_by_code(pool: &PgPool, code: &str) -> Result<Option<Invite>, ApiError> {
    let invite = sqlx::query_as::<_, Invite>(
        r#"SELECT code, server_id, created_by, created_at, expires_at, max_uses, uses
        FROM invites
        WHERE code = $1"#,
    )
    .bind(code)
    .fetch_optional(pool)
    .await?;
    Ok(invite)
}

pub async fn use_invite(pool: &PgPool, code: &str) -> Result<Invite, ApiError> {
    let invite = get_by_code(pool, code).await?.ok_or(ApiError::NotFound)?;
    if let Some(expires_at) = invite.expires_at {
        if expires_at < Utc::now() {
            return Err(ApiError::BadRequest("invite expired".to_string()));
        }
    }
    if let Some(max) = invite.max_uses {
        if invite.uses >= max {
            return Err(ApiError::BadRequest("invite exhausted".to_string()));
        }
    }

    let updated = sqlx::query_as::<_, Invite>(
        r#"UPDATE invites
        SET uses = uses + 1
        WHERE code = $1
        RETURNING code, server_id, created_by, created_at, expires_at, max_uses, uses"#,
    )
    .bind(code)
    .fetch_one(pool)
    .await?;
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_invite_code() {
        let code = generate_code();
        assert_eq!(code.len(), 10);
        assert!(code.chars().all(|c| c.is_ascii_alphanumeric()));
    }
}
