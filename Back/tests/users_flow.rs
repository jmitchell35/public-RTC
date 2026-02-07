use rtc_backend::{auth::hash_password, db};
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

#[tokio::test]
async fn user_profile_updates() {
    let pool = setup_db().await;
    let hash = hash_password("super_secret").expect("hash password");

    let user = db::users::create(&pool, "alice_user", "alice_user@example.com", &hash)
        .await
        .expect("create user");
    assert_eq!(user.friend_code.len(), 8);

    db::users::set_status(&pool, user.id, "dnd")
        .await
        .expect("set status");

    let fetched = db::users::get_by_id(&pool, user.id)
        .await
        .expect("get user")
        .expect("user");
    assert_eq!(fetched.status, "dnd");

    let updated = db::users::update_profile(
        &pool,
        user.id,
        Some("alice_new"),
        Some("alice_new@example.com"),
        None,
    )
    .await
    .expect("update profile")
    .expect("user");

    assert_eq!(updated.username, "alice_new");
    assert_eq!(updated.email, "alice_new@example.com");

    let by_code = db::users::find_by_friend_code(&pool, &updated.friend_code)
        .await
        .expect("find by code")
        .expect("user");
    assert_eq!(by_code.id, user.id);
}
