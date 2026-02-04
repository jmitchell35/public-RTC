# RTC Backend (Rust + Axum)

Rust backend for a Discord-like app (servers, channels, messages, users, notifications).

## Rust Documentation

- Global index: `src/DOCS.md`
- Rust root: `src/README.md`
- REST API: `src/api/README.md`
- Auth: `src/auth/README.md`
- DB: `src/db/README.md`
- Models: `src/models/README.md`
- Utils: `src/utils/README.md`
- WebSocket: `src/ws/README.md`

## Architecture

- axum for REST API + WebSocket
- tokio for async runtime
- PostgreSQL with sqlx (built-in migrations)
- JWT for authentication
- tower + tower-http for middlewares (tracing, CORS)
- serde for serialization
- tracing for logs

Main structure:

```
src/
  api/        # REST endpoints
  auth/       # JWT + auth middleware
  db/         # SQL queries
  models/     # entities
  utils/      # helpers/errors/validation
  ws/         # WebSocket
  state.rs    # AppState
```

## Configuration

Environment variables:

- DATABASE_URL (ex: postgres://postgres:postgres@localhost:5432/rtc)
- JWT_SECRET (secret key for tokens)
- JWT_EXP_SECONDS (ex: 604800)
- BIND_ADDR (ex: 0.0.0.0:3000)

Railway DB URLs:

- Public URL: `postgresql://postgres:tozqVSFCAKJWQbDoGkpRbYDryednOTDj@nozomi.proxy.rlwy.net:19714/railway`
- Internal URL: `postgresql://postgres:tozqVSFCAKJWQbDoGkpRbYDryednOTDj@postgres.railway.internal:5432/railway`

## Run the server

```bash
cargo run
```

SQL migrations run automatically at startup via sqlx::migrate!().

## Tests

```bash
cargo test
```

## REST endpoints (main)

### Auth
- POST /auth/signup
- POST /auth/login
- POST /auth/logout
- GET /me

### Servers (Guilds)
- POST /servers
- GET /servers
- GET /servers/{id}
- PUT /servers/{id}
- DELETE /servers/{id}
- POST /servers/{id}/join
- DELETE /servers/{id}/leave
- GET /servers/{id}/members
- PUT /servers/{id}/members/{userId}
- POST /servers/{id}/invites
- POST /invites/{code}/join

### Channels
- POST /servers/{serverId}/channels
- GET /servers/{serverId}/channels
- GET /channels/{id}
- PUT /channels/{id}
- DELETE /channels/{id}

### Messages
- POST /channels/{id}/messages
- GET /channels/{id}/messages
- DELETE /messages/{id}
- PUT /messages/{id} (edit)
- POST /messages/{id}/pin
- DELETE /messages/{id}/pin
- POST /messages/{id}/reactions
- GET /messages/{id}/reactions
- DELETE /messages/{id}/reactions

## JSON payload examples

### Signup
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "super_secret"
}
```

### Login
```json
{
  "identifier": "alice@example.com",
  "password": "super_secret"
}
```

### Create Server
```json
{
  "name": "My Server"
}
```

### Create Invite
```json
{
  "expires_in_hours": 24,
  "max_uses": 5
}
```

### Join Server
```json
{
  "invite_code": "A1B2C3D4E5"
}
```

### Create Channel
```json
{
  "name": "general"
}
```

### Send Message
```json
{
  "content": "Hello world!"
}
```

## WebSocket

Endpoint: GET /ws?token=JWT

The server validates the JWT before accepting the connection.

### Incoming messages (client -> server)

```json
{ "type": "JoinChannel", "data": { "channel_id": "UUID" } }
```
```json
{ "type": "SendMessage", "data": { "channel_id": "UUID", "content": "Hi" } }
```
```json
{ "type": "Typing", "data": { "channel_id": "UUID", "is_typing": true } }
```
```json
{ "type": "SubscribeServer", "data": { "server_id": "UUID" } }
```

### Outgoing messages (server -> client)

```json
{ "type": "Message", "data": { "message": { "id": "...", "channel_id": "...", "author_id": "...", "content": "...", "created_at": "..." } } }
```
```json
{ "type": "UserConnected", "data": { "server_id": "UUID", "user": { "id": "UUID", "username": "alice" } } }
```
```json
{ "type": "UserDisconnected", "data": { "server_id": "UUID", "user_id": "UUID" } }
```
```json
{ "type": "Typing", "data": { "channel_id": "UUID", "user_id": "UUID", "is_typing": true } }
```

## Permissions (summary)

- Member: read/write messages, view members, online/typing status
- Admin: all Member + create/delete/edit channels, delete others' messages, create invites
- Owner: all Admin + manage roles, transfer ownership, delete server

## Notes

- Messages are persisted and can be retrieved via GET /channels/{id}/messages.
- Online status is kept in memory (WebSocket) and exposed via GET /servers/{id}/members.
