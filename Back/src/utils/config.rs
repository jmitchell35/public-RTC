use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_exp_seconds: i64,
    pub bind_addr: String,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();
        let database_url = env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set (Railway PostgreSQL connection string).");
        let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret".to_string());
        let jwt_exp_seconds = env::var("JWT_EXP_SECONDS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60 * 60 * 24 * 7);
        let bind_addr = env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:3001".to_string());
        Self {
            database_url,
            jwt_secret,
            jwt_exp_seconds,
            bind_addr,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn set_var(key: &str, value: Option<&str>) -> Option<String> {
        let previous = env::var(key).ok();
        match value {
            Some(value) => unsafe { env::set_var(key, value) },
            None => unsafe { env::remove_var(key) },
        }
        previous
    }

    fn restore_var(key: &str, value: Option<String>) {
        match value {
            Some(value) => unsafe { env::set_var(key, value) },
            None => unsafe { env::remove_var(key) },
        }
    }

    #[test]
    fn config_reads_env_values() {
        let _guard = env_lock().lock().unwrap();
        let prev_db = set_var("DATABASE_URL", Some("postgres://example/db"));
        let prev_secret = set_var("JWT_SECRET", Some("test-secret"));
        let prev_exp = set_var("JWT_EXP_SECONDS", Some("123"));
        let prev_bind = set_var("BIND_ADDR", Some("127.0.0.1:9999"));

        let config = Config::from_env();

        assert_eq!(config.database_url, "postgres://example/db");
        assert_eq!(config.jwt_secret, "test-secret");
        assert_eq!(config.jwt_exp_seconds, 123);
        assert_eq!(config.bind_addr, "127.0.0.1:9999");

        restore_var("DATABASE_URL", prev_db);
        restore_var("JWT_SECRET", prev_secret);
        restore_var("JWT_EXP_SECONDS", prev_exp);
        restore_var("BIND_ADDR", prev_bind);
    }

    #[test]
    fn config_uses_defaults() {
        let _guard = env_lock().lock().unwrap();
        let prev_db = set_var("DATABASE_URL", Some("postgres://example/db"));
        let prev_secret = set_var("JWT_SECRET", None);
        let prev_exp = set_var("JWT_EXP_SECONDS", None);
        let prev_bind = set_var("BIND_ADDR", None);

        let config = Config::from_env();

        assert_eq!(config.jwt_secret, "dev-secret");
        assert_eq!(config.jwt_exp_seconds, 60 * 60 * 24 * 7);
        assert_eq!(config.bind_addr, "0.0.0.0:3001");

        restore_var("DATABASE_URL", prev_db);
        restore_var("JWT_SECRET", prev_secret);
        restore_var("JWT_EXP_SECONDS", prev_exp);
        restore_var("BIND_ADDR", prev_bind);
    }
}
