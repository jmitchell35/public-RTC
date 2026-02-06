use sqlx::PgPool;

pub mod channels;
pub mod direct_messages;
pub mod friends;
pub mod invites;
pub mod members;
pub mod messages;
pub mod reactions;
pub mod servers;
pub mod tokens;
pub mod users;



#[cfg(test)]
mod tests {
    use super::super::models::Role;

    #[test]
    fn role_ranking() {
        assert!(Role::Owner.rank() > Role::Member.rank());
    }
}
