# API - src/api

Handlers HTTP REST (Axum) et definition des routes.

## Fichiers
- mod.rs : assemble les routes publiques (auth + health) et protegees (middleware JWT + routes servers/channels/messages).
- auth.rs : endpoints signup/login/logout/me, validation d'entree, emission de JWT, revocation de token.
- servers.rs : CRUD serveurs, rejoindre/quitter, membres, roles, invitations.
- channels.rs : CRUD channels par serveur, controle des roles.
- messages.rs : envoi/liste/suppression de messages, broadcast WS des events.

## Endpoints et payloads

### auth.rs
- POST /auth/signup
  - Body: { "username": String, "email": String, "password": String }
  - Reponse: { "token": String, "user": UserPublic }
- POST /auth/login
  - Body: { "identifier": String, "password": String }
  - Reponse: { "token": String, "user": UserPublic }
- POST /auth/logout
  - Auth: Bearer JWT
  - Reponse: 204 No Content
- GET /me
  - Auth: Bearer JWT
  - Reponse: { "user": UserPublic }

### servers.rs
- POST /servers
  - Auth: Bearer JWT
  - Body: { "name": String }
  - Reponse: { "server": Server }
- GET /servers
  - Auth: Bearer JWT
  - Reponse: { "servers": [Server] }
- GET /servers/:id
  - Auth: Bearer JWT (membre)
  - Reponse: { "server": Server }
- GET /server/:id
  - Alias de /servers/:id
- PUT /servers/:id
  - Auth: Bearer JWT (owner)
  - Body: { "name": String }
  - Reponse: { "server": Server }
- DELETE /servers/:id
  - Auth: Bearer JWT (owner)
  - Reponse: 204 No Content
- POST /servers/:id/join
  - Auth: Bearer JWT
  - Body: { "invite_code": String }
  - Reponse: 204 No Content
- POST /invites/:code/join
  - Auth: Bearer JWT
  - Reponse: 204 No Content
- DELETE /servers/:id/leave
  - Auth: Bearer JWT (non owner)
  - Reponse: 204 No Content
- GET /servers/:id/members
  - Auth: Bearer JWT (membre)
  - Reponse: { "members": [MemberWithUser] }
- PUT /servers/:id/members/:user_id
  - Auth: Bearer JWT (owner)
  - Body: { "role": "owner" | "admin" | "member" }
  - Reponse: 204 No Content
- POST /servers/:id/invites
  - Auth: Bearer JWT (admin+)
  - Body: { "expires_in_hours"?: i64, "max_uses"?: i32 }
  - Reponse: { "code": String, "server_id": Uuid, "expires_at": DateTime?, "max_uses": i32?, "uses": i32 }

### channels.rs
- POST /servers/:server_id/channels
  - Auth: Bearer JWT (admin+)
  - Body: { "name": String }
  - Reponse: { "channel": Channel }
- GET /servers/:server_id/channels
  - Auth: Bearer JWT (membre)
  - Reponse: { "channels": [Channel] }
- GET /channels/:id
  - Auth: Bearer JWT (membre)
  - Reponse: { "channel": Channel }
- PUT /channels/:id
  - Auth: Bearer JWT (admin+)
  - Body: { "name": String }
  - Reponse: { "channel": Channel }
- DELETE /channels/:id
  - Auth: Bearer JWT (admin+)
  - Reponse: 204 No Content

### messages.rs
- POST /channels/:id/messages
  - Auth: Bearer JWT (membre)
  - Body: { "content": String }
  - Reponse: { "message": Message }
- GET /channels/:id/messages
  - Auth: Bearer JWT (membre)
  - Query: ?limit=i64&offset=i64
  - Reponse: { "messages": [Message] }
- DELETE /messages/:id
  - Auth: Bearer JWT (auteur ou admin)
  - Reponse: 204 No Content
