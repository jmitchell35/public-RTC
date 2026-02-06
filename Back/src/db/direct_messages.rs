use crate::{models::{DirectConversation, DirectMessage}, utils::ApiError};
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
) -> Result<Vec<DirectMessage>, ApiError> {
    let messages = sqlx::query_as::<_, DirectMessage>(
        r#"SELECT id, conversation_id, author_id, content, created_at
        FROM direct_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC"#,
    )
    .bind(conversation_id)
    .fetch_all(pool)
    .await?;
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
        RETURNING id, conversation_id, author_id, content, created_at"#,
    )
    .bind(message_id)
    .bind(conversation_id)
    .bind(author_id)
    .bind(content)
    .fetch_one(pool)
    .await?;
    Ok(message)
}
