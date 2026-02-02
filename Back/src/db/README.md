# DB - src/db

PostgreSQL access layer with SQLx. Each file exposes async functions returning `Result<_, ApiError>`.

## mod.rs
**Summary**
Exports DB submodules and runs migrations.

**Functions**
- `run_migrations(pool: &PgPool) -> Result<(), sqlx::Error>`

**Behaviors**
- Executes migrations in `./migrations` via `sqlx::migrate!()`.

**Errors**
- Propagates `sqlx::Error` on migration failure.

**Example**
```rust
db::run_migrations(&pool).await?;
```

## users.rs
**Summary**
User creation and reads.

**Functions**
- `create(pool, username, email, password_hash) -> Result<User, ApiError>`
- `find_by_email_or_username(pool, identifier) -> Result<Option<User>, ApiError>`
- `get_by_id(pool, user_id) -> Result<Option<User>, ApiError>`

**Behaviors**
- `create` generates a UUID and inserts into `users`.
- `find_by_email_or_username` searches by `email` OR `username`.
- `get_by_id` returns `None` if not found.

**Errors**
- `ApiError::Conflict` on unique violations (email/username).
- `ApiError::Internal` for other SQLx errors.

**Example**
```rust
let user = users::create(&pool, "alice", "a@b.com", &hash).await?;
```

## servers.rs
**Summary**
Server management and related entities (owner + default channel).

**Functions**
- `create(pool, name, owner_id) -> Result<Server, ApiError>`
- `list_for_user(pool, user_id) -> Result<Vec<Server>, ApiError>`
- `get_by_id(pool, server_id) -> Result<Option<Server>, ApiError>`
- `update_name(pool, server_id, name) -> Result<Option<Server>, ApiError>`
- `delete(pool, server_id) -> Result<(), ApiError>`

**Behaviors**
- `create` (transaction):
  - inserts into `servers`,
  - inserts into `server_members` (owner),
  - creates default `general` channel.
- `list_for_user` joins `server_members` to filter.
- `delete` removes the server (DB cascades if configured).

**Errors**
- `ApiError::Internal` for SQLx errors.

**Example**
```rust
let server = servers::create(&pool, "My Server", user_id).await?;
```

## channels.rs
**Summary**
Channel CRUD.

**Functions**
- `create(pool, server_id, name) -> Result<Channel, ApiError>`
- `list_for_server(pool, server_id) -> Result<Vec<Channel>, ApiError>`
- `get_by_id(pool, channel_id) -> Result<Option<Channel>, ApiError>`
- `update_name(pool, channel_id, name) -> Result<Option<Channel>, ApiError>`
- `delete(pool, channel_id) -> Result<(), ApiError>`

**Behaviors**
- `list_for_server` sorts by `created_at ASC`.

**Errors**
- `ApiError::Internal` for SQLx errors.

**Example**
```rust
let channel = channels::create(&pool, server_id, "general").await?;
```

## messages.rs
**Summary**
Create, list, and delete messages.

**Functions**
- `create(pool, channel_id, author_id, content) -> Result<Message, ApiError>`
- `list_for_channel(pool, channel_id, limit, offset) -> Result<Vec<Message>, ApiError>`
- `get_by_id(pool, message_id) -> Result<Option<Message>, ApiError>`
- `delete(pool, message_id) -> Result<(), ApiError>`

**Behaviors**
- `list_for_channel` returns messages ordered DESC (most recent first).

**Errors**
- `ApiError::Internal` for SQLx errors.

**Example**
```rust
let msgs = messages::list_for_channel(&pool, channel_id, 50, 0).await?;
```

## members.rs
**Summary**
Server members and roles management.

**Functions**
- `get_role(pool, server_id, user_id) -> Result<Option<Role>, ApiError>`
- `add_member(pool, server_id, user_id, role) -> Result<(), ApiError>`
- `remove_member(pool, server_id, user_id) -> Result<(), ApiError>`
- `list_members(pool, server_id) -> Result<Vec<(Uuid, String, Role)>, ApiError>`
- `list_server_ids_for_user(pool, user_id) -> Result<Vec<Uuid>, ApiError>`
- `update_role(pool, server_id, user_id, role) -> Result<(), ApiError>`
- `transfer_ownership(pool, server_id, new_owner_id, previous_owner_id) -> Result<(), ApiError>`
- `list_members_with_status(pool, server_id, online_checker) -> Result<Vec<MemberWithUser>, ApiError>`

**Behaviors**
- `get_role` converts SQL string into `Role` enum.
- `list_members` joins `users` to return usernames.
- `transfer_ownership` is transactional and downgrades previous owner to admin.
- `list_members_with_status` injects online presence via callback.

**Errors**
- `ApiError::Internal` for SQLx errors or invalid role conversion.

**Example**
```rust
members::add_member(&pool, server_id, user_id, Role::Member).await?;
```

## invites.rs
**Summary**
Invite codes for joining servers.

**Functions**
- `generate_code() -> String`
- `create(pool, server_id, created_by, expires_at?, max_uses?) -> Result<Invite, ApiError>`
- `get_by_code(pool, code) -> Result<Option<Invite>, ApiError>`
- `use_invite(pool, code) -> Result<Invite, ApiError>`

**Behaviors**
- `generate_code` produces a 10-char alphanumeric code.
- `use_invite`:
  - checks expiration,
  - checks max_uses,
  - increments `uses` in DB.

**Errors**
- `ApiError::NotFound` if code unknown.
- `ApiError::BadRequest` if invite expired or exhausted.
- `ApiError::Internal` for SQLx errors.

**Example**
```rust
let invite = invites::create(&pool, server_id, user_id, None, Some(5)).await?;
```

## tokens.rs
**Summary**
Stores revoked JWT tokens.

**Functions**
- `revoke(pool, jti) -> Result<(), ApiError>`
- `is_revoked(pool, jti) -> Result<bool, ApiError>`

**Behaviors**
- `revoke` inserts `jti`, ignores duplicates (ON CONFLICT DO NOTHING).
- `is_revoked` returns `true` if row exists.

**Errors**
- `ApiError::Internal` for SQLx errors.

**Example**
```rust
let revoked = tokens::is_revoked(&pool, &claims.jti).await?;
```
