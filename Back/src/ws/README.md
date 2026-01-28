# WebSocket - src/ws

Real-time events (WS) and in-memory presence.

## mod.rs
**Summary**
Defines the WS schema (incoming/outgoing), the broadcast hub, and presence state.

**Enums**
- `WsEvent` (server -> client):
  - `Message { message }`
  - `UserConnected { server_id, user }`
  - `UserDisconnected { server_id, user_id }`
  - `Typing { channel_id, user_id, is_typing }`
  - `Notification { server_id, content }`
- `WsInbound` (client -> server):
  - `JoinChannel { channel_id }`
  - `LeaveChannel { channel_id }`
  - `SendMessage { channel_id, content }`
  - `Typing { channel_id, is_typing }`
  - `SubscribeServer { server_id }`
  - `UnsubscribeServer { server_id }`
  - `Ping`

**Structs / functions**
- `WsHub`:
  - `new() -> WsHub`
  - `channel_sender(channel_id) -> broadcast::Sender<WsEvent>`
  - `server_sender(server_id) -> broadcast::Sender<WsEvent>`
  - `broadcast_channel(channel_id, event)`
  - `broadcast_server(server_id, event)`
- `PresenceState`:
  - `new() -> PresenceState`
  - `set_online(server_id, user_id, online)`
  - `is_online(server_id, user_id) -> bool`
  - `set_typing(channel_id, user_id, typing)`
  - `is_typing(channel_id, user_id) -> bool`

**Behaviors**
- `WsHub` maintains broadcast channels per server and per channel.
- `PresenceState` keeps online/typing users in memory.

**Errors**
- None (in-memory structures).

**Examples**
```json
{ "type": "Typing", "data": { "channel_id": "UUID", "user_id": "UUID", "is_typing": true } }
```

## handler.rs
**Summary**
WS handshake, JWT auth, receive loop, server/channel subscriptions, event fan-out, presence management.

**Structures**
- `WsQuery { token: Option<String> }`

**Functions**
- `ws_handler(State, HeaderMap, Query<WsQuery>, WebSocketUpgrade) -> Result<impl IntoResponse, ApiError>`
- `handle_socket(socket, state, user_id)`
- `handle_inbound(inbound, state, user_id, out_tx, server_tasks, channel_tasks, subscribed_channels)`
- `spawn_forwarder(rx, out_tx) -> JoinHandle<()>`
- `subscribe_channel(hub, out_tx, channel_id, tasks)`
- `subscribe_server(hub, out_tx, server_id, tasks)`

**Behaviors**
- `ws_handler`:
  - gets token (query ?token=... or Authorization),
  - decodes JWT,
  - rejects if token revoked,
  - upgrades WS then calls `handle_socket`.
- `handle_socket`:
  - loads user from DB,
  - lists user servers,
  - marks presence online,
  - subscribes to servers,
  - loops on incoming messages:
    - parse JSON into `WsInbound`,
    - apply logic (join/leave/typing/send).
  - on close:
    - marks presence offline,
    - broadcasts `UserDisconnected`.
- `handle_inbound`:
  - `JoinChannel` -> subscribe to channel.
  - `LeaveChannel` -> unsubscribe.
  - `SubscribeServer`/`UnsubscribeServer` -> subscribe/unsubscribe.
  - `SendMessage` -> check role, create message in DB, broadcast event + notification.
  - `Typing` -> update typing state + broadcast.
  - `Ping` -> returns a `Notification` (pong).

**Errors**
- `ApiError::Unauthorized` if token missing/invalid/revoked.
- `ApiError::Internal` if DB access fails during handshake.
- After upgrade, DB errors are handled silently (drop/return) to avoid crashing the WS.

**Examples**
```json
// Client -> server
{ "type": "JoinChannel", "data": { "channel_id": "UUID" } }
```
```json
// Client -> server
{ "type": "SendMessage", "data": { "channel_id": "UUID", "content": "Hi" } }
```
