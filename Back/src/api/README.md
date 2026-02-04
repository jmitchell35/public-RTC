# API - src/api

HTTP REST handlers (Axum) and route definitions. Each file below is documented in detail.

## mod.rs
**Summary**
Assembles public and protected routes. Applies JWT middleware to protected routes.

**Functions**
- `router(state: AppState) -> Router<AppState>`
- `health() -> &'static str`

**Behaviors**
- Public routes:
  - `POST /auth/signup`
  - `POST /auth/login`
  - `GET /health`
- Protected routes (JWT middleware):
  - `GET /me`
  - `POST /auth/logout`
  - all `servers`, `channels`, `messages` routes

**Errors**
- Middleware returns `401 Unauthorized` if JWT missing/invalid/revoked.

**Example**
```bash
curl http://localhost:3000/health
```

## auth.rs
**Summary**
Signup, login, logout, and current-user retrieval.

**Structures**
- `SignupRequest { username, email, password }`
- `LoginRequest { identifier, password }`
- `AuthResponse { token, user }`
- `MeResponse { user }`

**Functions**
- `routes() -> Router<AppState>`
- `signup(State, Json<SignupRequest>) -> ApiResult<AuthResponse>`
- `login(State, Json<LoginRequest>) -> ApiResult<AuthResponse>`
- `logout(State, HeaderMap, Extension<AuthUser>) -> Result<StatusCode, ApiError>`
- `me(State, Extension<AuthUser>) -> ApiResult<MeResponse>`
- `SignupRequest::validate() -> bool`

**Behaviors**
- `signup`:
  - validates username and password (length),
  - hashes password (Argon2),
  - creates user in DB,
  - returns JWT + `UserPublic`.
- `login`:
  - finds user by email or username,
  - verifies password,
  - returns JWT + `UserPublic`.
- `logout`:
  - extracts Bearer token,
  - decodes JWT,
  - stores `jti` in `revoked_tokens`.
- `me`:
  - returns current user (DB).

**Errors**
- `signup`:
  - `400 BadRequest` if username/password invalid,
  - `409 Conflict` if email/username already exists (unique violation),
  - `500 Internal` for DB errors.
- `login`:
  - `401 Unauthorized` if unknown identifier or wrong password,
  - `500 Internal` for DB errors.
- `logout`:
  - `401 Unauthorized` if token missing/invalid,
  - `500 Internal` for DB errors.
- `me`:
  - `404 NotFound` if user missing,
  - `500 Internal` for DB errors.

**Examples**
```json
// POST /auth/signup
{ "username": "alice", "email": "alice@example.com", "password": "super_secret" }
```
```json
// POST /auth/login
{ "identifier": "alice@example.com", "password": "super_secret" }
```

## servers.rs
**Summary**
Server management (create/list/get/update/delete) + members + roles + invites + join/leave.

**Structures**
- `CreateServerRequest { name }`
- `UpdateServerRequest { name }`
- `JoinServerRequest { invite_code: Option<String> }`
- `UpdateMemberRoleRequest { role: Role }`
- `CreateInviteRequest { expires_in_hours?: i64, max_uses?: i32 }`
- `ServerResponse { server }`
- `ServersResponse { servers }`
- `MembersResponse { members: Vec<MemberWithUser> }`
- `InviteResponse { code, server_id, expires_at?, max_uses?, uses }`

**Functions**
- `routes() -> Router<AppState>`
- `create_server(...) -> ApiResult<ServerResponse>`
- `list_servers(...) -> ApiResult<ServersResponse>`
- `get_server(...) -> ApiResult<ServerResponse>`
- `update_server(...) -> ApiResult<ServerResponse>`
- `delete_server(...) -> Result<StatusCode, ApiError>`
- `join_server(...) -> Result<StatusCode, ApiError>`
- `join_by_invite(...) -> Result<StatusCode, ApiError>`
- `leave_server(...) -> Result<StatusCode, ApiError>`
- `list_members(...) -> ApiResult<MembersResponse>`
- `update_member_role(...) -> Result<StatusCode, ApiError>`
- `create_invite(...) -> ApiResult<InviteResponse>`
- `ensure_member(...) -> Result<Role, ApiError>`
- `ensure_role(...) -> Result<Role, ApiError>`

**Behaviors**
- `create_server` creates a server + owner + "general" channel (DB transaction).
- `get_server` requires the user to be a member.
- `update_server` and `delete_server` require role `Owner`.
- `join_server` and `join_by_invite` consume an invite and add the user as `Member`.
- `leave_server` prevents the owner from leaving.
- `list_members` also returns online status via `PresenceState`.
- `update_member_role` supports ownership transfer.
- `create_invite` supports expiration and max_uses.

**Errors**
- Access:
  - `401 Unauthorized` if JWT missing/invalid.
  - `403 Forbidden` if not a member or insufficient role.
- Validation:
  - `400 BadRequest` if name invalid or invite missing/invalid.
- Conflict:
  - `409 Conflict` if already a member.
- DB:
  - `404 NotFound` if server or member missing.
  - `500 Internal` for SQL errors.

**Examples**
```json
// POST /servers
{ "name": "My Server" }
```
```json
// POST /servers/:id/invites
{ "expires_in_hours": 24, "max_uses": 5 }
```

## channels.rs
**Summary**
Channel CRUD with role checks.

**Structures**
- `CreateChannelRequest { name }`
- `UpdateChannelRequest { name }`
- `ChannelResponse { channel }`
- `ChannelsResponse { channels }`

**Functions**
- `routes() -> Router<AppState>`
- `create_channel(...) -> ApiResult<ChannelResponse>`
- `list_channels(...) -> ApiResult<ChannelsResponse>`
- `get_channel(...) -> ApiResult<ChannelResponse>`
- `update_channel(...) -> ApiResult<ChannelResponse>`
- `delete_channel(...) -> Result<StatusCode, ApiError>`
- `ensure_role(...) -> Result<Role, ApiError>`

**Behaviors**
- `create/update/delete` require `Admin`.
- `list/get` require `Member`.
- Validates channel name length.

**Errors**
- `400 BadRequest` if name invalid.
- `403 Forbidden` if role insufficient.
- `404 NotFound` if channel/server not found.
- `500 Internal` for SQL errors.

**Examples**
```json
// POST /servers/:server_id/channels
{ "name": "general" }
```

## messages.rs
**Summary**
Send/list/delete messages. Broadcasts WS events on send.

**Structures**
- `SendMessageRequest { content }`
- `EditMessageRequest { content }`
- `ReactionRequest { emoji }`
- `MessageResponse { message }`
- `MessagesResponse { messages }`
- `ReactionsResponse { reactions }`
- `Pagination { limit?: i64, offset?: i64 }`

**Functions**
- `routes() -> Router<AppState>`
- `send_message(...) -> ApiResult<MessageResponse>`
- `list_messages(...) -> ApiResult<MessagesResponse>`
- `delete_message(...) -> Result<StatusCode, ApiError>`
- `edit_message(...) -> ApiResult<MessageResponse>`
- `pin_message(...) -> ApiResult<MessageResponse>`
- `unpin_message(...) -> ApiResult<MessageResponse>`
- `add_reaction(...) -> ApiResult<ReactionsResponse>`
- `remove_reaction(...) -> ApiResult<ReactionsResponse>`
- `list_reactions(...) -> ApiResult<ReactionsResponse>`

**Behaviors**
- `send_message`:
  - rejects empty content,
  - checks `Member` role,
  - creates message,
  - broadcasts to channel + server notification.
- `list_messages`:
  - pagination (limit 1..100, offset >= 0),
  - order by created_at DESC.
- `delete_message`:
  - allowed for author or `Admin`.
- `edit_message`:
  - allowed for author or `Admin`,
  - sets `edited_at`.
- `pin_message` / `unpin_message`:
  - `Admin+` only, toggles `pinned`.
- `add_reaction` / `remove_reaction` / `list_reactions`:
  - `Member` only, manages emoji reactions for a message.

**Errors**
- `400 BadRequest` if content empty.
- `403 Forbidden` if role insufficient.
- `404 NotFound` if channel/message missing.
- `500 Internal` for SQL errors.

**Examples**
```json
// POST /channels/:id/messages
{ "content": "Hello world" }
```
