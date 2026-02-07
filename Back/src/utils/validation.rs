pub fn validate_username(username: &str) -> bool {
    let len = username.len();
    len >= 3 && len <= 32
}

pub fn validate_password(password: &str) -> bool {
    password.len() >= 8
}

pub fn validate_server_name(name: &str) -> bool {
    let len = name.len();
    len >= 2 && len <= 64
}

pub fn validate_channel_name(name: &str) -> bool {
    let len = name.len();
    len >= 2 && len <= 64
}

pub fn validate_user_status(status: &str) -> bool {
    matches!(status, "online" | "offline" | "dnd")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_username() {
        assert!(validate_username("alice"));
        assert!(!validate_username("al"));
    }

    #[test]
    fn validates_password() {
        assert!(!validate_password("short"));
        assert!(validate_password("long_enough"));
    }

    #[test]
    fn validates_server_name() {
        assert!(validate_server_name("ab"));
        assert!(!validate_server_name("a"));
        assert!(!validate_server_name(&"x".repeat(65)));
    }

    #[test]
    fn validates_channel_name() {
        assert!(validate_channel_name("general"));
        assert!(!validate_channel_name("x"));
        assert!(!validate_channel_name(&"x".repeat(65)));
    }

    #[test]
    fn validates_status() {
        assert!(validate_user_status("online"));
        assert!(validate_user_status("offline"));
        assert!(validate_user_status("dnd"));
        assert!(!validate_user_status("away"));
    }
}
