use crate::{db, state::AppState, utils::ApiError};
use argon2::{password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString}, Argon2};
use axum::{body::Body, extract::State, http::Request, middleware::Next, response::Response};
use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use rand::thread_rng;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone)]
pub struct JwtConfig {
    secret: String,
    exp_seconds: i64,
}

impl JwtConfig {
    pub fn new(secret: String, exp_seconds: i64) -> Self {
        Self { secret, exp_seconds }
    }

    pub fn issue_token(&self, user_id: Uuid) -> Result<(String, Claims), ApiError> {
        let now = Utc::now();
        let exp = now + Duration::seconds(self.exp_seconds);
        let jti = Uuid::new_v4().to_string();
        let claims = Claims {
            sub: user_id,
            iat: now.timestamp(),
            exp: exp.timestamp(),
            jti,
        };
        let token = jsonwebtoken::encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret.as_bytes()),
        )?;
        Ok((token, claims))
    }

    pub fn decode_token(&self, token: &str) -> Result<Claims, ApiError> {
        let data = jsonwebtoken::decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.secret.as_bytes()),
            &Validation::default(),
        )?;
        Ok(data.claims)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub iat: i64,
    pub exp: i64,
    pub jti: String,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
}

pub fn hash_password(password: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut thread_rng());
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|_| ApiError::Internal)?
        .to_string();
    Ok(hash)
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, ApiError> {
    let parsed_hash = PasswordHash::new(hash).map_err(|_| ApiError::Unauthorized)?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

pub fn extract_bearer_token(headers: &axum::http::HeaderMap) -> Option<String> {
    let header = headers.get(axum::http::header::AUTHORIZATION)?;
    let header = header.to_str().ok()?;
    header.strip_prefix("Bearer ").map(|v| v.to_string())
}

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, ApiError> {
    let token = extract_bearer_token(req.headers()).ok_or(ApiError::Unauthorized)?;
    let claims = state.jwt.decode_token(&token)?;
    if db::tokens::is_revoked(&state.db, &claims.jti).await? {
        return Err(ApiError::Unauthorized);
    }
    req.extensions_mut().insert(AuthUser { user_id: claims.sub });
    Ok(next.run(req).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_hash_roundtrip() {
        let hash = hash_password("super_secret").expect("hash");
        assert!(verify_password("super_secret", &hash).unwrap());
        assert!(!verify_password("wrong", &hash).unwrap());
    }

    #[test]
    fn jwt_roundtrip() {
        let cfg = JwtConfig::new("secret".to_string(), 60);
        let (token, claims) = cfg.issue_token(Uuid::new_v4()).expect("token");
        let decoded = cfg.decode_token(&token).expect("decode");
        assert_eq!(claims.sub, decoded.sub);
    }
}
