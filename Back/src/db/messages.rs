use crate::{models::Message, utils::ApiError};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn create(
    pool: &PgPool,
    channel_id: Uuid,
    author_id: Uuid,
    content: &str,
) -> Result<Message, ApiError> {
    let message_id = Uuid::new_v4();
    let message = sqlx::query_as::<_, Message>(
        r#"INSERT INTO messages (id, channel_id, author_id, content)
        VALUES ($1, $2, $3, $4)
        RETURNING id, channel_id, author_id, content, created_at, edited_at, pinned"#,
    )
    .bind(message_id)
    .bind(channel_id)
    .bind(author_id)
    .bind(content)
    .fetch_one(pool)
    .await?;
    Ok(message)
}

pub async fn list_for_channel(
    pool: &PgPool,
    channel_id: Uuid,
    limit: i64,
    before: Option<DateTime<Utc>>,
) -> Result<Vec<Message>, ApiError> {
    let mut messages = sqlx::query_as::<_, Message>(
        r#"SELECT id, channel_id, author_id, content, created_at, edited_at, pinned
        FROM messages
        WHERE channel_id = $1
          AND ($2::timestamptz IS NULL OR created_at < $2)
        ORDER BY created_at DESC
        LIMIT $3"#,
    )
    .bind(channel_id)
    .bind(before)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    messages.reverse();
    Ok(messages)
}

pub async fn get_by_id(pool: &PgPool, message_id: Uuid) -> Result<Option<Message>, ApiError> {
    let message = sqlx::query_as::<_, Message>(
        r#"SELECT id, channel_id, author_id, content, created_at, edited_at, pinned
        FROM messages
        WHERE id = $1"#,
    )
    .bind(message_id)
    .fetch_optional(pool)
    .await?;
    Ok(message)
}

pub async fn delete(pool: &PgPool, message_id: Uuid) -> Result<(), ApiError> {
    sqlx::query("DELETE FROM messages WHERE id = $1")
        .bind(message_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_content(
    pool: &PgPool,
    message_id: Uuid,
    content: &str,
) -> Result<Option<Message>, ApiError> {
    let message = sqlx::query_as::<_, Message>(
        r#"UPDATE messages
        SET content = $2, edited_at = NOW()
        WHERE id = $1
        RETURNING id, channel_id, author_id, content, created_at, edited_at, pinned"#,
    )
    .bind(message_id)
    .bind(content)
    .fetch_optional(pool)
    .await?;
    Ok(message)
}

pub async fn set_pinned(
    pool: &PgPool,
    message_id: Uuid,
    pinned: bool,
) -> Result<Option<Message>, ApiError> {
    let message = sqlx::query_as::<_, Message>(
        r#"UPDATE messages
        SET pinned = $2
        WHERE id = $1
        RETURNING id, channel_id, author_id, content, created_at, edited_at, pinned"#,
    )
    .bind(message_id)
    .bind(pinned)
    .fetch_optional(pool)
    .await?;
    Ok(message)
}
