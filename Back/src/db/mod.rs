use sqlx::PgPool;

pub mod channels;
pub mod friends;
pub mod invites;
pub mod members;
pub mod messages;
pub mod reactions;
pub mod servers;
pub mod tokens;
pub mod users;

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::super::models::Role;

    #[test]
    fn role_ranking() {
        assert!(Role::Owner.rank() > Role::Member.rank());
    }
}
