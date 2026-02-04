use crate::{models::MessageReaction, utils::ApiError};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn add(
    pool: &PgPool,
    message_id: Uuid,
    user_id: Uuid,
    emoji: &str,
) -> Result<MessageReaction, ApiError> {
    let reaction = sqlx::query_as::<_, MessageReaction>(
        r#"INSERT INTO message_reactions (message_id, user_id, emoji)
        VALUES ($1, $2, $3)
        RETURNING message_id, user_id, emoji, created_at"#,
    )
    .bind(message_id)
    .bind(user_id)
    .bind(emoji)
    .fetch_one(pool)
    .await?;
    Ok(reaction)
}

pub async fn remove(
    pool: &PgPool,
    message_id: Uuid,
    user_id: Uuid,
    emoji: &str,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"DELETE FROM message_reactions
        WHERE message_id = $1 AND user_id = $2 AND emoji = $3"#,
    )
    .bind(message_id)
    .bind(user_id)
    .bind(emoji)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_for_message(
    pool: &PgPool,
    message_id: Uuid,
) -> Result<Vec<MessageReaction>, ApiError> {
    let reactions = sqlx::query_as::<_, MessageReaction>(
        r#"SELECT message_id, user_id, emoji, created_at
        FROM message_reactions
        WHERE message_id = $1
        ORDER BY created_at ASC"#,
    )
    .bind(message_id)
    .fetch_all(pool)
    .await?;
    Ok(reactions)
}
