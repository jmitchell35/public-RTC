use rtc_backend::{auth::hash_password, db, utils::ApiError};
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
async fn invite_use_limits() {
    let pool = setup_db().await;
    let owner_id = create_user(&pool, "owner_invite", "owner_invite@example.com").await;

    let server = db::servers::create(&pool, "Invite Server", owner_id)
        .await
        .expect("create server");

    let invite = db::invites::create(&pool, server.id, owner_id, None, Some(1))
        .await
        .expect("create invite");
    assert_eq!(invite.uses, 0);

    let fetched = db::invites::get_by_code(&pool, &invite.code)
        .await
        .expect("get invite")
        .expect("invite");
    assert_eq!(fetched.code, invite.code);

    let used = db::invites::use_invite(&pool, &invite.code)
        .await
        .expect("use invite");
    assert_eq!(used.uses, 1);

    let err = db::invites::use_invite(&pool, &invite.code)
        .await
        .expect_err("should be exhausted");
    match err {
        ApiError::BadRequest(message) => assert!(message.contains("exhausted")),
        other => panic!("unexpected error: {other:?}"),
    }
}
