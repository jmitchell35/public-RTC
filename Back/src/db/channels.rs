use crate::{models::Channel, utils::ApiError};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn create(
    pool: &PgPool,
    server_id: Uuid,
    name: &str,
) -> Result<Channel, ApiError> {
    let channel_id = Uuid::new_v4();
    let channel = sqlx::query_as::<_, Channel>(
        r#"INSERT INTO channels (id, server_id, name)
        VALUES ($1, $2, $3)
        RETURNING id, server_id, name, created_at"#,
    )
    .bind(channel_id)
    .bind(server_id)
    .bind(name)
    .fetch_one(pool)
    .await?;
    Ok(channel)
}

pub async fn list_for_server(
    pool: &PgPool,
    server_id: Uuid,
) -> Result<Vec<Channel>, ApiError> {
    let channels = sqlx::query_as::<_, Channel>(
        r#"SELECT id, server_id, name, created_at
        FROM channels
        WHERE server_id = $1
        ORDER BY created_at ASC"#,
    )
    .bind(server_id)
    .fetch_all(pool)
    .await?;
    Ok(channels)
}

pub async fn get_by_id(pool: &PgPool, channel_id: Uuid) -> Result<Option<Channel>, ApiError> {
    let channel = sqlx::query_as::<_, Channel>(
        r#"SELECT id, server_id, name, created_at
        FROM channels
        WHERE id = $1"#,
    )
    .bind(channel_id)
    .fetch_optional(pool)
    .await?;
    Ok(channel)
}

pub async fn update_name(
    pool: &PgPool,
    channel_id: Uuid,
    name: &str,
) -> Result<Option<Channel>, ApiError> {
    let channel = sqlx::query_as::<_, Channel>(
        r#"UPDATE channels
        SET name = $2
        WHERE id = $1
        RETURNING id, server_id, name, created_at"#,
    )
    .bind(channel_id)
    .bind(name)
    .fetch_optional(pool)
    .await?;
    Ok(channel)
}

pub async fn delete(pool: &PgPool, channel_id: Uuid) -> Result<(), ApiError> {
    sqlx::query("DELETE FROM channels WHERE id = $1")
        .bind(channel_id)
        .execute(pool)
        .await?;
    Ok(())
}
