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

async fn create_user(pool: &PgPool, username: &str, email: &str) -> Uuid {
    let hash = hash_password("super_secret").expect("hash password");
    db::users::create(pool, username, email, &hash)
        .await
        .expect("create user")
        .id
}

#[tokio::test]
async fn friend_request_accept_creates_friendship() {
    let pool = setup_db().await;
    let alice = create_user(&pool, "alice", "alice@example.com").await;
    let bob = create_user(&pool, "bob", "bob@example.com").await;

    let request = db::friends::create_request(&pool, alice, bob)
        .await
        .expect("create request");

    let requester = db::friends::accept_request(&pool, request.id, bob)
        .await
        .expect("accept request");
    assert_eq!(requester, alice);

    let friends_of_alice = db::friends::list_friends(&pool, alice)
        .await
        .expect("list friends");
    let friends_of_bob = db::friends::list_friends(&pool, bob)
        .await
        .expect("list friends");

    assert_eq!(friends_of_alice.len(), 1);
    assert_eq!(friends_of_bob.len(), 1);
    assert_eq!(friends_of_alice[0].id, bob);
    assert_eq!(friends_of_bob[0].id, alice);
}
