use crate::{
    models::{DirectConversation, DirectMessage},
    utils::ApiError,
};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

fn order_users(user_a: Uuid, user_b: Uuid) -> (Uuid, Uuid) {
    if user_a < user_b {
        (user_a, user_b)
    } else {
        (user_b, user_a)
    }
}

pub async fn get_conversation(
    pool: &PgPool,
    user_a: Uuid,
    user_b: Uuid,
) -> Result<Option<DirectConversation>, ApiError> {
    let (user_a, user_b) = order_users(user_a, user_b);
    let convo = sqlx::query_as::<_, DirectConversation>(
        r#"SELECT id, user_a, user_b, created_at
        FROM direct_conversations
        WHERE user_a = $1 AND user_b = $2"#,
    )
    .bind(user_a)
    .bind(user_b)
    .fetch_optional(pool)
    .await?;
    Ok(convo)
}

pub async fn get_conversation_by_id(
    pool: &PgPool,
    conversation_id: Uuid,
) -> Result<Option<DirectConversation>, ApiError> {
    let convo = sqlx::query_as::<_, DirectConversation>(
        r#"SELECT id, user_a, user_b, created_at
        FROM direct_conversations
        WHERE id = $1"#,
    )
    .bind(conversation_id)
    .fetch_optional(pool)
    .await?;
    Ok(convo)
}

pub async fn get_or_create_conversation(
    pool: &PgPool,
    user_a: Uuid,
    user_b: Uuid,
) -> Result<DirectConversation, ApiError> {
    let (user_a, user_b) = order_users(user_a, user_b);
    let convo_id = Uuid::new_v4();
    let convo = sqlx::query_as::<_, DirectConversation>(
        r#"INSERT INTO direct_conversations (id, user_a, user_b)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_a, user_b) DO NOTHING
        RETURNING id, user_a, user_b, created_at"#,
    )
    .bind(convo_id)
    .bind(user_a)
    .bind(user_b)
    .fetch_optional(pool)
    .await?;

    if let Some(convo) = convo {
        return Ok(convo);
    }

    let existing = sqlx::query_as::<_, DirectConversation>(
        r#"SELECT id, user_a, user_b, created_at
        FROM direct_conversations
        WHERE user_a = $1 AND user_b = $2"#,
    )
    .bind(user_a)
    .bind(user_b)
    .fetch_one(pool)
    .await?;
    Ok(existing)
}

pub async fn list_messages(
    pool: &PgPool,
    conversation_id: Uuid,
    limit: i64,
    before: Option<DateTime<Utc>>,
) -> Result<Vec<DirectMessage>, ApiError> {
    let mut messages = sqlx::query_as::<_, DirectMessage>(
        r#"SELECT id, conversation_id, author_id, content, created_at, edited_at
        FROM direct_messages
        WHERE conversation_id = $1
          AND ($2::timestamptz IS NULL OR created_at < $2)
        ORDER BY created_at DESC
        LIMIT $3"#,
    )
    .bind(conversation_id)
    .bind(before)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    messages.reverse();
    Ok(messages)
}

pub async fn list_messages_for_users(
    pool: &PgPool,
    user_a: Uuid,
    user_b: Uuid,
    limit: i64,
    before: Option<DateTime<Utc>>,
) -> Result<Vec<DirectMessage>, ApiError> {
    let (user_a, user_b) = order_users(user_a, user_b);
    let mut messages = sqlx::query_as::<_, DirectMessage>(
        r#"SELECT dm.id, dm.conversation_id, dm.author_id, dm.content, dm.created_at, dm.edited_at
        FROM direct_messages dm
        JOIN direct_conversations dc ON dm.conversation_id = dc.id
        WHERE dc.user_a = $1
          AND dc.user_b = $2
          AND ($3::timestamptz IS NULL OR dm.created_at < $3)
        ORDER BY dm.created_at DESC
        LIMIT $4"#,
    )
    .bind(user_a)
    .bind(user_b)
    .bind(before)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    messages.reverse();
    Ok(messages)
}

pub async fn create_message(
    pool: &PgPool,
    conversation_id: Uuid,
    author_id: Uuid,
    content: &str,
) -> Result<DirectMessage, ApiError> {
    let message_id = Uuid::new_v4();
    let message = sqlx::query_as::<_, DirectMessage>(
        r#"INSERT INTO direct_messages (id, conversation_id, author_id, content)
        VALUES ($1, $2, $3, $4)
        RETURNING id, conversation_id, author_id, content, created_at, edited_at"#,
    )
    .bind(message_id)
    .bind(conversation_id)
    .bind(author_id)
    .bind(content)
    .fetch_one(pool)
    .await?;
    Ok(message)
}

pub async fn get_message_by_id(
    pool: &PgPool,
    message_id: Uuid,
) -> Result<Option<DirectMessage>, ApiError> {
    let message = sqlx::query_as::<_, DirectMessage>(
        r#"SELECT id, conversation_id, author_id, content, created_at, edited_at
        FROM direct_messages
        WHERE id = $1"#,
    )
    .bind(message_id)
    .fetch_optional(pool)
    .await?;
    Ok(message)
}

pub async fn update_message_content(
    pool: &PgPool,
    message_id: Uuid,
    content: &str,
) -> Result<Option<DirectMessage>, ApiError> {
    let message = sqlx::query_as::<_, DirectMessage>(
        r#"UPDATE direct_messages
        SET content = $2, edited_at = NOW()
        WHERE id = $1
        RETURNING id, conversation_id, author_id, content, created_at, edited_at"#,
    )
    .bind(message_id)
    .bind(content)
    .fetch_optional(pool)
    .await?;
    Ok(message)
}

pub async fn delete_message(pool: &PgPool, message_id: Uuid) -> Result<(), ApiError> {
    sqlx::query("DELETE FROM direct_messages WHERE id = $1")
        .bind(message_id)
        .execute(pool)
        .await?;
    Ok(())
}
