# Auth - src/auth

Authentication management (JWT) and passwords.

## mod.rs
**Summary**
Defines JWT configuration, claims, password hashing (Argon2), and auth middleware.

**Structs**
- `JwtConfig { secret: String, exp_seconds: i64 }`
- `Claims { sub: Uuid, iat: i64, exp: i64, jti: String }`
- `AuthUser { user_id: Uuid }`

**Functions**
- `JwtConfig::new(secret, exp_seconds) -> JwtConfig`
- `JwtConfig::issue_token(user_id) -> Result<(String, Claims), ApiError>`
- `JwtConfig::decode_token(token) -> Result<Claims, ApiError>`
- `hash_password(password) -> Result<String, ApiError>`
- `verify_password(password, hash) -> Result<bool, ApiError>`
- `extract_bearer_token(headers) -> Option<String>`
- `auth_middleware(State<AppState>, Request<Body>, Next) -> Result<Response, ApiError>`

**Behaviors**
- `issue_token`:
  - generates a unique `jti`,
  - fills `iat`/`exp` with `Utc::now()`,
  - encodes with HS256 (jsonwebtoken).
- `decode_token`:
  - decodes/validates the token using the secret.
- `hash_password`:
  - uses Argon2 + random salt,
  - returns a DB-storable hash.
- `verify_password`:
  - parses the stored hash,
  - verifies the provided password.
- `extract_bearer_token`:
  - extracts "Bearer <token>" from Authorization header.
- `auth_middleware`:
  - decodes JWT,
  - checks token is not revoked (`revoked_tokens`),
  - injects `AuthUser` into request extensions.

**Errors**
- `issue_token`/`decode_token`:
  - `ApiError::Unauthorized` if decode invalid.
  - `ApiError::Internal` if encode fails.
- `hash_password`:
  - `ApiError::Internal` if Argon2 fails.
- `verify_password`:
  - `ApiError::Unauthorized` if hash invalid.
- `auth_middleware`:
  - `ApiError::Unauthorized` if token missing/invalid/revoked.
  - `ApiError::Internal` on DB errors.

**Examples**
```rust
let jwt = JwtConfig::new("secret".to_string(), 3600);
let (token, claims) = jwt.issue_token(user_id)?;
let decoded = jwt.decode_token(&token)?;
```
