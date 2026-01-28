use crate::{models::Message, utils::ApiError};
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
        RETURNING id, channel_id, author_id, content, created_at"#,
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
    offset: i64,
) -> Result<Vec<Message>, ApiError> {
    let messages = sqlx::query_as::<_, Message>(
        r#"SELECT id, channel_id, author_id, content, created_at
        FROM messages
        WHERE channel_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3"#,
    )
    .bind(channel_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    Ok(messages)
}

pub async fn get_by_id(pool: &PgPool, message_id: Uuid) -> Result<Option<Message>, ApiError> {
    let message = sqlx::query_as::<_, Message>(
        r#"SELECT id, channel_id, author_id, content, created_at
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
