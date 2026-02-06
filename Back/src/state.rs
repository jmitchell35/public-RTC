use crate::{
    auth::JwtConfig,
    ws::{PresenceState, WsHub},
};
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub jwt: JwtConfig,
    pub ws_hub: Arc<WsHub>,
    pub presence: Arc<PresenceState>,
}

impl AppState {
    pub fn new(db: PgPool, jwt: JwtConfig) -> Self {
        Self {
            db,
            jwt,
            ws_hub: Arc::new(WsHub::new()),
            presence: Arc::new(PresenceState::new()),
        }
    }
}
