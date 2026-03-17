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
async fn channel_and_message_flow() {
    let pool = setup_db().await;
    let owner_id = create_user(&pool, "owner_chat", "owner_chat@example.com").await;

    let server = db::servers::create(&pool, "Chat Server", owner_id)
        .await
        .expect("create server");

    let channel = db::channels::create(&pool, server.id, "random")
        .await
        .expect("create channel");
    let renamed = db::channels::update_name(&pool, channel.id, "news")
        .await
        .expect("update channel")
        .expect("channel");
    assert_eq!(renamed.name, "news");

    let message = db::messages::create(&pool, channel.id, owner_id, "hello")
        .await
        .expect("create message");
    let list = db::messages::list_for_channel(&pool, channel.id, 50, None)
        .await
        .expect("list messages");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].content, "hello");

    let updated = db::messages::update_content(&pool, message.id, "edited")
        .await
        .expect("update content")
        .expect("message");
    assert_eq!(updated.content, "edited");
    assert!(updated.edited_at.is_some());

    let pinned = db::messages::set_pinned(&pool, message.id, true)
        .await
        .expect("pin")
        .expect("message");
    assert!(pinned.pinned);

    db::messages::delete(&pool, message.id)
        .await
        .expect("delete message");
    assert!(db::messages::get_by_id(&pool, message.id)
        .await
        .expect("get message")
        .is_none());

    db::channels::delete(&pool, channel.id)
        .await
        .expect("delete channel");
    assert!(db::channels::get_by_id(&pool, channel.id)
        .await
        .expect("get channel")
        .is_none());
}
