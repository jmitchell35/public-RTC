use rtc_backend::db;
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
async fn token_revocation_marks_jti() {
    let pool = setup_db().await;
    let jti = format!("test-{}", Uuid::new_v4());

    let revoked = db::tokens::is_revoked(&pool, &jti)
        .await
        .expect("is revoked");
    assert!(!revoked);

    db::tokens::revoke(&pool, &jti)
        .await
        .expect("revoke");

    let revoked = db::tokens::is_revoked(&pool, &jti)
        .await
        .expect("is revoked");
    assert!(revoked);
}
