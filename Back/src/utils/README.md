# Utils - src/utils

Common utilities (config, API errors, validation).

## mod.rs
**Summary**
Re-exports `ApiError` and `ApiResult`.

**Exports**
- `pub use error::{ApiError, ApiResult};`

**Errors**
- None.

**Example**
```rust
use crate::utils::{ApiError, ApiResult};
```

## config.rs
**Summary**
Loads configuration via environment variables.

**Structs / functions**
- `Config { database_url, jwt_secret, jwt_exp_seconds, bind_addr }`
- `Config::from_env() -> Config`

**Behaviors**
- Loads `.env` if present (`dotenvy`).
- Default values:
  - `DATABASE_URL`: `postgres://postgres:postgres@localhost:5432/rtc`
  - `JWT_SECRET`: `dev-secret`
  - `JWT_EXP_SECONDS`: 7 days
  - `BIND_ADDR`: `0.0.0.0:3000`

**Errors**
- None (fallback to defaults).

**Example**
```rust
let cfg = Config::from_env();
```

## error.rs
**Summary**
Unified error model for the HTTP API.

**Types**
- `ApiResult<T> = Result<Json<T>, ApiError>`
- `ApiError` variants:
  - `Unauthorized`
  - `Forbidden`
  - `NotFound`
  - `BadRequest(String)`
  - `Conflict(String)`
  - `Internal`

**Behaviors**
- `IntoResponse` maps errors to `StatusCode` and JSON `{ "error": "..." }`.
- `From<sqlx::Error>`:
  - `Conflict` on unique violation,
  - otherwise `Internal` with log.
- `From<jsonwebtoken::errors::Error>` -> `Unauthorized`.

**Errors**
- Errors are converted to standard HTTP responses.

**Example**
```rust
return Err(ApiError::BadRequest("invalid input".to_string()));
```

## validation.rs
**Summary**
Simple field validation.

**Functions**
- `validate_username(username) -> bool` (3..=32)
- `validate_password(password) -> bool` (>= 8)
- `validate_server_name(name) -> bool` (2..=64)
- `validate_channel_name(name) -> bool` (2..=64)

**Behaviors**
- Length-only checks.

**Errors**
- None (returns bool).

**Example**
```rust
if !validate_password("short") {
    // reject request
}
```
