use crate::{models::User, utils::ApiError};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn create(
    pool: &PgPool,
    username: &str,
    email: &str,
    password_hash: &str,
) -> Result<User, ApiError> {
    let user_id = Uuid::new_v4();
    let friend_code = user_id.simple().to_string()[..8].to_string();
    let user = sqlx::query_as::<_, User>(
        r#"INSERT INTO users (id, username, email, password_hash, friend_code)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, username, email, password_hash, friend_code, created_at"#,
    )
    .bind(user_id)
    .bind(username)
    .bind(email)
    .bind(password_hash)
    .bind(friend_code)
    .fetch_one(pool)
    .await?;
    Ok(user)
}

pub async fn find_by_email_or_username(
    pool: &PgPool,
    identifier: &str,
) -> Result<Option<User>, ApiError> {
    let user = sqlx::query_as::<_, User>(
        r#"SELECT id, username, email, password_hash, friend_code, created_at
        FROM users
        WHERE email = $1 OR username = $1"#,
    )
    .bind(identifier)
    .fetch_optional(pool)
    .await?;
    Ok(user)
}

pub async fn get_by_id(pool: &PgPool, user_id: Uuid) -> Result<Option<User>, ApiError> {
    let user = sqlx::query_as::<_, User>(
        r#"SELECT id, username, email, password_hash, friend_code, created_at
        FROM users
        WHERE id = $1"#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    Ok(user)
}

pub async fn find_by_friend_code(
    pool: &PgPool,
    friend_code: &str,
) -> Result<Option<User>, ApiError> {
    let user = sqlx::query_as::<_, User>(
        r#"SELECT id, username, email, password_hash, friend_code, created_at
        FROM users
        WHERE friend_code = $1"#,
    )
    .bind(friend_code)
    .fetch_optional(pool)
    .await?;
    Ok(user)
}
