use crate::{models::{MemberWithUser, Role}, utils::ApiError};
use sqlx::PgPool;
use std::str::FromStr;
use uuid::Uuid;

pub async fn get_role(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
) -> Result<Option<Role>, ApiError> {
    let role: Option<String> = sqlx::query_scalar(
        "SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2",
    )
    .bind(server_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    Ok(role.and_then(|r| Role::from_str(&r).ok()))
}

pub async fn add_member(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
    role: Role,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"INSERT INTO server_members (server_id, user_id, role)
        VALUES ($1, $2, $3)"#,
    )
    .bind(server_id)
    .bind(user_id)
    .bind(role.as_str())
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn remove_member(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
) -> Result<(), ApiError> {
    sqlx::query("DELETE FROM server_members WHERE server_id = $1 AND user_id = $2")
        .bind(server_id)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_members(
    pool: &PgPool,
    server_id: Uuid,
) -> Result<Vec<(Uuid, String, Role)>, ApiError> {
    let rows = sqlx::query_as::<_, (Uuid, String, String, String)>(
        r#"SELECT u.id, u.username, u.status, sm.role
        FROM server_members sm
        JOIN users u ON u.id = sm.user_id
        WHERE sm.server_id = $1
        ORDER BY u.username ASC"#,
    )
    .bind(server_id)
    .fetch_all(pool)
    .await?;

    let members = rows
        .into_iter()
        .filter_map(|(id, username, status, role)| {
            Role::from_str(&role).ok().map(|r| (id, username, status, r))
        })
        .collect();
    Ok(members)
}

pub async fn list_server_ids_for_user(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<Uuid>, ApiError> {
    let ids = sqlx::query_scalar(
        "SELECT server_id FROM server_members WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(ids)
}

pub async fn update_role(
    pool: &PgPool,
    server_id: Uuid,
    user_id: Uuid,
    role: Role,
) -> Result<(), ApiError> {
    sqlx::query(
        "UPDATE server_members SET role = $3 WHERE server_id = $1 AND user_id = $2",
    )
    .bind(server_id)
    .bind(user_id)
    .bind(role.as_str())
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn transfer_ownership(
    pool: &PgPool,
    server_id: Uuid,
    new_owner_id: Uuid,
    previous_owner_id: Uuid,
) -> Result<(), ApiError> {
    let mut tx = pool.begin().await?;

    sqlx::query("UPDATE servers SET owner_id = $2 WHERE id = $1")
        .bind(server_id)
        .bind(new_owner_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query(
        "UPDATE server_members SET role = 'owner' WHERE server_id = $1 AND user_id = $2",
    )
    .bind(server_id)
    .bind(new_owner_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE server_members SET role = 'admin' WHERE server_id = $1 AND user_id = $2",
    )
    .bind(server_id)
    .bind(previous_owner_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn list_members_with_status(
    pool: &PgPool,
    server_id: Uuid,
    online_checker: impl Fn(Uuid) -> bool,
) -> Result<Vec<MemberWithUser>, ApiError> {
    let rows = list_members(pool, server_id).await?;
    let members = rows
        .into_iter()
        .map(|(user_id, username, status, role)| MemberWithUser {
            user_id,
            username,
            role,
            status,
            online: online_checker(user_id),
        })
        .collect();
    Ok(members)
}
