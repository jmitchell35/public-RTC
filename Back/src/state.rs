use crate::{auth::JwtConfig, ws::{PresenceState, WsHub}};
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub jwt: JwtConfig,
    pub ws_hub: WsHub,
    pub presence: PresenceState,
}

impl AppState {
    pub fn new(db: PgPool, jwt: JwtConfig) -> Self {
        Self {
            db,
            jwt,
            ws_hub: WsHub::new(),
            presence: PresenceState::new(),
        }
    }
}
