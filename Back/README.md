# RTC Backend (Rust + Axum)

Backend Rust pour une application type Discord (serveurs, channels, messages, utilisateurs, notifications).

## Architecture

- axum pour l'API REST + WebSocket
- tokio pour l'async
- PostgreSQL avec sqlx (migrations integrees)
- JWT pour l'authentification
- tower + tower-http pour middlewares (tracing, CORS)
- serde pour la serialisation
- tracing pour les logs

Structure (principale) :

```
src/
  api/        # endpoints REST
  auth/       # JWT + auth middleware
  db/         # requetes SQL
  models/     # entites
  utils/      # helpers/erreurs/validation
  ws/         # WebSocket
  state.rs    # AppState
```

## Configuration

Variables d'environnement :

- DATABASE_URL (ex: postgres://postgres:postgres@localhost:5432/rtc)
- JWT_SECRET (cle secrete pour les tokens)
- JWT_EXP_SECONDS (ex: 604800)
- BIND_ADDR (ex: 0.0.0.0:3000)

## Lancer le serveur

```bash
cargo run
```

Migrations SQL automatiquement au demarrage via sqlx::migrate!().

## Tests

```bash
cargo test
```

## Endpoints REST (principaux)

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

## Exemples de payloads JSON

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
  "name": "Mon Serveur"
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

Le serveur verifie le token JWT avant d'accepter la connexion.

### Messages entrants (client -> serveur)

```json
{ "type": "JoinChannel", "data": { "channel_id": "UUID" } }
```
```json
{ "type": "SendMessage", "data": { "channel_id": "UUID", "content": "Salut" } }
```
```json
{ "type": "Typing", "data": { "channel_id": "UUID", "is_typing": true } }
```
```json
{ "type": "SubscribeServer", "data": { "server_id": "UUID" } }
```

### Messages sortants (serveur -> client)

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

## Permissions (resume)

- Member: lire/ecrire messages, voir membres, statut en ligne/typing
- Admin: tout ce que Member + creer/supprimer/editer channels, supprimer messages d'autres users, creer invitations
- Owner: tout ce que Admin + gerer roles, transferer ownership, supprimer serveur

## Notes

- Les messages sont persistes et recuperables via GET /channels/{id}/messages.
- Le statut en ligne est maintenu en memoire (WebSocket) et expose via GET /servers/{id}/members.
