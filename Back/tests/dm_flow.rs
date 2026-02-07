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
async fn direct_message_flow_creates_conversation_and_lists_messages() {
    let pool = setup_db().await;
    let alice = create_user(&pool, "alice_dm", "alice_dm@example.com").await;
    let bob = create_user(&pool, "bob_dm", "bob_dm@example.com").await;

    let convo = db::direct_messages::get_or_create_conversation(&pool, bob, alice)
        .await
        .expect("create conversation");

    let msg = db::direct_messages::create_message(&pool, convo.id, alice, "hello")
        .await
        .expect("create message");
    assert_eq!(msg.content, "hello");

    let messages = db::direct_messages::list_messages_for_users(&pool, alice, bob, 10, None)
        .await
        .expect("list messages");
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].content, "hello");

    let updated = db::direct_messages::update_message_content(&pool, msg.id, "edited")
        .await
        .expect("update message")
        .expect("message");
    assert_eq!(updated.content, "edited");
    assert!(updated.edited_at.is_some());
}
