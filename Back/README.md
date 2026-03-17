# RTC Backend (Rust + Axum)

Rust backend for a Discord-like app: servers, channels, messages, direct messages, friends, reactions, presence, and real-time WebSocket events.

## Architecture

- **axum 0.8** — REST API + WebSocket
- **tokio** — async runtime
- **sqlx 0.7** — PostgreSQL with compile-time checked queries and built-in migrations
- **JWT** — authentication (jsonwebtoken)
- **argon2** — password hashing
- **tower + tower-http** — CORS, tracing middleware
- **serde** — serialization
- **tracing + tracing-subscriber** — structured logging
- **dashmap** — concurrent in-memory presence/typing state

Source layout:

```
src/
  api/        REST endpoints (servers, channels, messages, dm, friends, auth, users)
  api/guards  Shared auth helpers (ensure_member, ensure_role, add_member_to_server)
  auth/       JWT config + auth middleware
  db/         SQL query functions
  models/     Entity types (User, Server, Channel, Message, ...)
  utils/      Error types, validation helpers
  ws/         WebSocket handler + WsHub + PresenceState
  state.rs    AppState (db pool, ws hub, presence)
```

## Rust Documentation

- Global index: `src/DOCS.md`
- REST API: `src/api/README.md`
- Auth: `src/auth/README.md`
- DB: `src/db/README.md`
- Models: `src/models/README.md`
- Utils: `src/utils/README.md`
- WebSocket: `src/ws/README.md`

## Configuration

Copy `.env.example` to `.env` and fill in:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/rtc` |
| `JWT_SECRET` | Token signing secret | `dev-secret` |
| `JWT_EXP_SECONDS` | Token lifetime | `604800` (7 days) |
| `BIND_ADDR` | Bind address | `0.0.0.0:3001` |

## Running locally

### With mise (recommended)

[mise](https://mise.jdx.dev/) manages the Rust toolchain and task runner.

```bash
mise install          # installs Rust (stable)
mise run db           # start Postgres via Docker Compose
mise run dev          # cargo run (auto-loads .env)
```

Available tasks:

| Task | Command |
|---|---|
| `mise run dev` | `cargo run` |
| `mise run check` | `cargo check` |
| `mise run build` | `cargo build --release` |
| `mise run test` | `cargo test -- --test-threads=1` |
| `mise run db` | `docker compose up -d db` |
| `mise run db-stop` | `docker compose down` |

### Without mise

```bash
docker compose up -d db
cargo run
```

SQL migrations run automatically at startup via `sqlx::migrate!()`.

## Docker

A multi-stage `Dockerfile` is included for production deployment (e.g. Render):

```bash
docker build \
  --build-arg DATABASE_URL=postgresql://... \
  -t rtc-backend .
docker run -e DATABASE_URL=... -e JWT_SECRET=... -e PORT=3001 rtc-backend
```

The image uses `debian:bookworm-slim` at runtime. The `PORT` env var (set by Render) is mapped to `BIND_ADDR` automatically.

## Tests

Integration tests create an isolated PostgreSQL schema per run:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/rtc \
  cargo test -- --test-threads=1
```

Optional coverage (requires `cargo-llvm-cov`):

```bash
cargo llvm-cov --workspace --summary
```

## REST API

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/signup` | Register |
| POST | `/auth/login` | Login, sets `auth_token` cookie |
| POST | `/auth/logout` | Clears cookie |
| GET | `/me` | Current user |

### Users
| Method | Path | Description |
|---|---|---|
| GET | `/users/{id}` | Get user profile |
| PUT | `/users/{id}` | Update username/email/password |
| DELETE | `/users/{id}` | Delete account |
| POST | `/me/status` | Update presence status |

### Servers
| Method | Path | Description |
|---|---|---|
| POST | `/servers` | Create server |
| GET | `/servers` | List joined servers |
| GET | `/servers/{id}` | Get server |
| PUT | `/servers/{id}` | Update name (Owner) |
| DELETE | `/servers/{id}` | Delete server (Owner) |
| POST | `/servers/{id}/join` | Join via invite code |
| DELETE | `/servers/{id}/leave` | Leave server |
| GET | `/servers/{id}/members` | List members with online status |
| PUT | `/servers/{id}/members/{userId}` | Update member role (Owner) |
| DELETE | `/servers/{id}/members/{userId}` | Kick member (Owner) |
| POST | `/servers/{id}/members/{userId}/ban` | Ban member (Owner) |
| DELETE | `/servers/{id}/members/{userId}/ban` | Unban member (Owner) |
| POST | `/servers/{id}/invites` | Create invite (Admin+) |
| POST | `/invites/{code}/join` | Join via invite link |

### Channels
| Method | Path | Description |
|---|---|---|
| POST | `/servers/{id}/channels` | Create channel (Admin+) |
| GET | `/servers/{id}/channels` | List channels |
| GET | `/channels/{id}` | Get channel |
| PUT | `/channels/{id}` | Rename channel (Admin+) |
| DELETE | `/channels/{id}` | Delete channel (Admin+) |

### Messages
| Method | Path | Description |
|---|---|---|
| POST | `/channels/{id}/messages` | Send message |
| GET | `/channels/{id}/messages` | List messages (cursor-based: `?limit=50&before=<ISO8601>`) |
| PUT | `/messages/{id}` | Edit own message |
| DELETE | `/messages/{id}` | Delete message (own or Admin+) |
| POST | `/messages/{id}/pin` | Pin message (Admin+) |
| DELETE | `/messages/{id}/pin` | Unpin message (Admin+) |
| POST | `/messages/{id}/reactions` | Add reaction |
| GET | `/messages/{id}/reactions` | List reactions |
| DELETE | `/messages/{id}/reactions` | Remove reaction |

### Direct Messages
| Method | Path | Description |
|---|---|---|
| GET | `/dm/{friendId}` | Get DM history (`?limit=50&before=<ISO8601>`) |
| POST | `/dm/{friendId}` | Send DM |
| PUT | `/dm/messages/{id}` | Edit own DM |
| DELETE | `/dm/messages/{id}` | Delete own DM |

### Friends
| Method | Path | Description |
|---|---|---|
| GET | `/friends` | List friends |
| GET | `/friends/requests` | List incoming/outgoing requests |
| POST | `/friends/requests` | Send friend request (by `friend_code`) |
| POST | `/friends/requests/{id}/accept` | Accept request |
| DELETE | `/friends/requests/{id}` | Reject or cancel request |

## JSON payload examples

**Signup**
```json
{ "username": "alice", "email": "alice@example.com", "password": "super_secret" }
```

**Login**
```json
{ "identifier": "alice@example.com", "password": "super_secret" }
```

**Send message / Edit message**
```json
{ "content": "Hello world!" }
```

**Create invite**
```json
{ "expires_in_hours": 24, "max_uses": 5 }
```

**Ban member**
```json
{ "duration_minutes": 60, "reason": "spamming" }
```
Omit `duration_minutes` for a permanent ban.

**Add reaction**
```json
{ "emoji": "👍" }
```

## WebSocket

Endpoint: `GET /ws?token=<JWT>`

The JWT is validated before the connection is accepted.

### Client → Server

```json
{ "type": "JoinChannel",       "data": { "channel_id": "UUID" } }
{ "type": "LeaveChannel",      "data": { "channel_id": "UUID" } }
{ "type": "SendMessage",       "data": { "channel_id": "UUID", "content": "Hi" } }
{ "type": "Typing",            "data": { "channel_id": "UUID", "is_typing": true } }
{ "type": "SubscribeServer",   "data": { "server_id": "UUID" } }
{ "type": "UnsubscribeServer", "data": { "server_id": "UUID" } }
{ "type": "DirectTyping",      "data": { "friend_id": "UUID", "is_typing": true } }
{ "type": "Ping" }
```

### Server → Client

```json
{ "type": "Message",               "data": { "message": { ... } } }
{ "type": "MessageUpdated",        "data": { "message": { ... } } }
{ "type": "MessageDeleted",        "data": { "channel_id": "UUID", "message_id": "UUID" } }
{ "type": "MessagePinned",         "data": { "channel_id": "UUID", "message_id": "UUID", "pinned": true } }
{ "type": "ReactionAdded",         "data": { "channel_id": "UUID", "message_id": "UUID", "reaction": { ... } } }
{ "type": "ReactionRemoved",       "data": { "channel_id": "UUID", "message_id": "UUID", "user_id": "UUID", "emoji": "👍" } }
{ "type": "Typing",                "data": { "channel_id": "UUID", "user_id": "UUID", "is_typing": true } }
{ "type": "UserConnected",         "data": { "server_id": "UUID", "user": { ... } } }
{ "type": "UserDisconnected",      "data": { "server_id": "UUID", "user_id": "UUID" } }
{ "type": "ServerMembersUpdated",  "data": { "server_id": "UUID" } }
{ "type": "Notification",          "data": { "server_id": "UUID", "content": "..." } }
{ "type": "DirectMessage",         "data": { "friend_id": "UUID", "message": { ... } } }
{ "type": "DirectMessageUpdated",  "data": { "friend_id": "UUID", "message": { ... } } }
{ "type": "DirectMessageDeleted",  "data": { "friend_id": "UUID", "message_id": "UUID" } }
{ "type": "DirectTyping",          "data": { "friend_id": "UUID", "is_typing": true } }
{ "type": "FriendRequestCreated",  "data": { "direction": "incoming"|"outgoing", "request": { ... } } }
{ "type": "FriendRequestAccepted", "data": { "request_id": "UUID", "friend": { ... } } }
{ "type": "FriendRequestRemoved",  "data": { "request_id": "UUID" } }
{ "type": "FriendStatusUpdated",   "data": { "user": { ... } } }
```

## Permissions

| Action | Member | Admin | Owner |
|---|:---:|:---:|:---:|
| Read/write messages | ✓ | ✓ | ✓ |
| Delete own messages | ✓ | ✓ | ✓ |
| View members & online status | ✓ | ✓ | ✓ |
| Create/rename/delete channels | | ✓ | ✓ |
| Delete others' messages | | ✓ | ✓ |
| Create invites | | ✓ | ✓ |
| Kick / ban members | | | ✓ |
| Manage roles | | | ✓ |
| Transfer ownership | | | ✓ |
| Delete server | | | ✓ |
