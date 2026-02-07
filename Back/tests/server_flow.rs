use rtc_backend::{
    auth::hash_password,
    db,
    models::Role,
};
use sqlx::PgPool;
use uuid::Uuid;

async fn setup_db() -> PgPool {
    dotenvy::dotenv().ok();
    let base_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for tests");

    let schema = format!("test_{}", Uuid::new_v4().to_string().replace('-', "_"));
    let admin_pool = PgPool::connect(&base_url).await.expect("connect admin pool");
    sqlx::query(&format!("CREATE SCHEMA {}", schema))
        .execute(&admin_pool)
        .await
        .expect("create schema");

    let url_with_schema = with_search_path(&base_url, &schema);
    let pool = PgPool::connect(&url_with_schema).await.expect("connect test pool");
    db::run_migrations(&pool).await.expect("run migrations");
    pool
}

fn with_search_path(base: &str, schema: &str) -> String {
    let sep = if base.contains('?') { '&' } else { '?' };
    format!("{base}{sep}options=-c%20search_path%3D{schema}")
}

async fn create_user(pool: &PgPool, username: &str, email: &str) -> Uuid {
    let hash = hash_password("super_secret").expect("hash password");
    db::users::create(pool, username, email, &hash)
        .await
        .expect("create user")
        .id
}

#[tokio::test]
async fn server_create_adds_owner_and_default_channel() {
    let pool = setup_db().await;
    let owner_id = create_user(&pool, "owner", "owner@example.com").await;

    let server = db::servers::create(&pool, "Test Server", owner_id)
        .await
        .expect("create server");

    let role = db::members::get_role(&pool, server.id, owner_id)
        .await
        .expect("get role")
        .expect("role");
    assert_eq!(role, Role::Owner);

    let channels = db::channels::list_for_server(&pool, server.id)
        .await
        .expect("list channels");
    assert!(!channels.is_empty());
    assert_eq!(channels[0].name, "general");
}

#[tokio::test]
async fn server_list_includes_memberships() {
    let pool = setup_db().await;
    let owner_id = create_user(&pool, "owner2", "owner2@example.com").await;
    let member_id = create_user(&pool, "member2", "member2@example.com").await;

    let server = db::servers::create(&pool, "Another Server", owner_id)
        .await
        .expect("create server");

    db::members::add_member(&pool, server.id, member_id, Role::Member)
        .await
        .expect("add member");

    let servers_for_member = db::servers::list_for_user(&pool, member_id)
        .await
        .expect("list servers");
    assert_eq!(servers_for_member.len(), 1);
    assert_eq!(servers_for_member[0].id, server.id);
}

#[tokio::test]
async fn update_role_changes_membership() {
    let pool = setup_db().await;
    let owner_id = create_user(&pool, "owner3", "owner3@example.com").await;
    let member_id = create_user(&pool, "member3", "member3@example.com").await;

    let server = db::servers::create(&pool, "Role Server", owner_id)
        .await
        .expect("create server");
    db::members::add_member(&pool, server.id, member_id, Role::Member)
        .await
        .expect("add member");

    db::members::update_role(&pool, server.id, member_id, Role::Admin)
        .await
        .expect("update role");

    let role = db::members::get_role(&pool, server.id, member_id)
        .await
        .expect("get role")
        .expect("role");
    assert_eq!(role, Role::Admin);
}
