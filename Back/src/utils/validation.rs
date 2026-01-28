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
}
