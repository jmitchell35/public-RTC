# Rust backend - src/

Ce dossier contient le coeur du backend Rust (Axum + SQLx + WebSocket).

## Fichiers
- lib.rs : declare les modules publics exposes par le crate (api, auth, db, models, utils, ws, state).
- main.rs : point d'entree; charge la config, initialise le logger, cree le pool Postgres, lance les migrations et demarre Axum + WebSocket.
- state.rs : definit AppState partage (pool DB, JWT config, hub WS, presence).

## Sous-dossiers
- api/ : handlers HTTP REST et routes publiques/protegees.
- auth/ : JWT, hash/verification mot de passe, middleware d'auth.
- db/ : couche acces base (SQLx) par entite.
- models/ : structures de donnees et types partages.
- utils/ : config, erreurs API, validation.
- ws/ : WebSocket (events, presence, handler).
