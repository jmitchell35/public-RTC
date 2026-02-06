# Rust backend - src/

Detailed documentation of the Rust core. Each file below is described with summary, functions, behaviors, errors, and examples.

## Root files

### lib.rs
**Summary**
Exports the public modules of the crate (API, auth, DB, models, utils, WS, state).

**Functions / exports**
- `pub mod api` : HTTP router.
- `pub mod auth` : JWT + middleware + hashing.
- `pub mod db` : SQLx access layer.
- `pub mod models` : shared structs.
- `pub mod utils` : config, errors, validation.
- `pub mod ws` : WebSocket + presence.
- `pub mod state` : AppState.

**Behaviors**
- Serves as the assembly point for the crate's external API.

**Errors**
- None (module declarations only).

**Example**
```rust
use rtc_backend::{api, auth, db, models, utils, ws, state};
```

### main.rs
**Summary**
Binary entrypoint. Loads config, initializes logging, creates the Postgres pool, runs migrations, mounts HTTP/WS routes.

**Functions**
- `main() -> Result<(), anyhow::Error>`

**Behaviors**
- Loads environment via `Config::from_env()`.
- Initializes `tracing_subscriber` (env filter + fmt layer).
- Creates a Postgres pool with `PgPoolOptions::connect`.
- Runs `db::run_migrations` (SQLx migrations).
- Builds `JwtConfig`, `AppState`, then `api::router`.
- Mounts `/ws` via `ws_handler`.
- Enables permissive CORS and HTTP tracing.
- Binds to `BIND_ADDR` and starts Axum.

**Errors**
- Returns `anyhow::Error` if:
  - DB connection fails,
  - migrations fail,
  - TCP bind fails,
  - HTTP server fails to run.

**Example**
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/rtc \
BIND_ADDR=0.0.0.0:3000 \
cargo run
```

### state.rs
**Summary**
Shared state for API and WebSocket.

**Structs / functions**
- `AppState { db: PgPool, jwt: JwtConfig, ws_hub: Arc<WsHub>, presence: Arc<PresenceState> }`
- `AppState::new(db, jwt) -> AppState`

**Behaviors**
- Builds a WS hub and in-memory presence on creation.

**Errors**
- None (pure initialization).

**Example**
```rust
let state = AppState::new(pool, jwt_config);
```
