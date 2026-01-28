use crate::{models::Server, utils::ApiError};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn create(pool: &PgPool, name: &str, owner_id: Uuid) -> Result<Server, ApiError> {
    let mut tx = pool.begin().await?;
    let server_id = Uuid::new_v4();

    let server = sqlx::query_as::<_, Server>(
        r#"INSERT INTO servers (id, name, owner_id)
        VALUES ($1, $2, $3)
        RETURNING id, name, owner_id, created_at"#,
    )
    .bind(server_id)
    .bind(name)
    .bind(owner_id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        r#"INSERT INTO server_members (server_id, user_id, role)
        VALUES ($1, $2, 'owner')"#,
    )
    .bind(server_id)
    .bind(owner_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"INSERT INTO channels (id, server_id, name)
        VALUES ($1, $2, 'general')"#,
    )
    .bind(Uuid::new_v4())
    .bind(server_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(server)
}

pub async fn list_for_user(pool: &PgPool, user_id: Uuid) -> Result<Vec<Server>, ApiError> {
    let servers = sqlx::query_as::<_, Server>(
        r#"SELECT s.id, s.name, s.owner_id, s.created_at
        FROM servers s
        INNER JOIN server_members sm ON sm.server_id = s.id
        WHERE sm.user_id = $1
        ORDER BY s.created_at DESC"#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(servers)
}

pub async fn get_by_id(pool: &PgPool, server_id: Uuid) -> Result<Option<Server>, ApiError> {
    let server = sqlx::query_as::<_, Server>(
        r#"SELECT id, name, owner_id, created_at
        FROM servers
        WHERE id = $1"#,
    )
    .bind(server_id)
    .fetch_optional(pool)
    .await?;
    Ok(server)
}

pub async fn update_name(
    pool: &PgPool,
    server_id: Uuid,
    name: &str,
) -> Result<Option<Server>, ApiError> {
    let server = sqlx::query_as::<_, Server>(
        r#"UPDATE servers
        SET name = $2
        WHERE id = $1
        RETURNING id, name, owner_id, created_at"#,
    )
    .bind(server_id)
    .bind(name)
    .fetch_optional(pool)
    .await?;
    Ok(server)
}

pub async fn delete(pool: &PgPool, server_id: Uuid) -> Result<(), ApiError> {
    sqlx::query("DELETE FROM servers WHERE id = $1")
        .bind(server_id)
        .execute(pool)
        .await?;
    Ok(())
}
