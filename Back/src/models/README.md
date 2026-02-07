# Models - src/models

Shared data structures between DB, API, and WS.

## mod.rs
**Summary**
Defines ID types, model structs, and the `Role` enum.

**ID types**
- `UserId = Uuid`
- `ServerId = Uuid`
- `ChannelId = Uuid`
- `MessageId = Uuid`

**Structs**
- `User { id, username, email, password_hash, friend_code, status, created_at }`
- `UserPublic { id, username, friend_code, status }`
- `Server { id, name, owner_id, created_at }`
- `Channel { id, server_id, name, created_at }`
- `Message { id, channel_id, author_id, content, created_at, edited_at?, pinned }`
- `Invite { code, server_id, created_by, created_at, expires_at?, max_uses?, uses }`
- `ServerMember { server_id, user_id, role, joined_at }`
- `MemberWithUser { user_id, username, status, friend_code, role, online }`
- `MessageReaction { message_id, user_id, emoji, created_at }`

**Enum**
- `Role::Owner | Role::Admin | Role::Member`
  - `as_str() -> &str`
  - `rank() -> u8`
  - `allows(required: Role) -> bool`
  - `Display` for formatting
  - `FromStr` for parsing

**Behaviors**
- `UserPublic::from(&User)` hides sensitive fields (email/password_hash).
- `Role::allows` checks permissions via `rank()`.
- `FromStr` accepts only "owner", "admin", "member".

**Errors**
- `Role::from_str` returns `Err(())` for unknown values.

**Examples**
```rust
let role = Role::Admin;
assert!(role.allows(Role::Member));
```
```rust
let public = UserPublic::from(&user);
```
