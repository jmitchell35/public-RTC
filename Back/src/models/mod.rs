use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};
use uuid::Uuid;

pub type UserId = Uuid;
pub type ServerId = Uuid;
pub type ChannelId = Uuid;
pub type MessageId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: UserId,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub friend_code: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserPublic {
    pub id: UserId,
    pub username: String,
    pub friend_code: String,
    pub status: String,
}

impl From<&User> for UserPublic {
    fn from(user: &User) -> Self {
        Self {
            id: user.id,
            username: user.username.clone(),
            friend_code: user.friend_code.clone(),
            status: user.status.clone(),
        }
    }
}

pub type DirectConversationId = Uuid;
pub type DirectMessageId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DirectConversation {
    pub id: DirectConversationId,
    pub user_a: UserId,
    pub user_b: UserId,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DirectMessage {
    pub id: DirectMessageId,
    pub conversation_id: DirectConversationId,
    pub author_id: UserId,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub edited_at: Option<DateTime<Utc>>,
}

pub type DirectConversationId = Uuid;
pub type DirectMessageId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DirectConversation {
    pub id: DirectConversationId,
    pub user_a: UserId,
    pub user_b: UserId,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DirectMessage {
    pub id: DirectMessageId,
    pub conversation_id: DirectConversationId,
    pub author_id: UserId,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub edited_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Server {
    pub id: ServerId,
    pub name: String,
    pub owner_id: UserId,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Channel {
    pub id: ChannelId,
    pub server_id: ServerId,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Message {
    pub id: MessageId,
    pub channel_id: ChannelId,
    pub author_id: UserId,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub edited_at: Option<DateTime<Utc>>,
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Invite {
    pub code: String,
    pub server_id: ServerId,
    pub created_by: UserId,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_uses: Option<i32>,
    pub uses: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MessageReaction {
    pub message_id: MessageId,
    pub user_id: UserId,
    pub emoji: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ServerMember {
    pub server_id: ServerId,
    pub user_id: UserId,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberWithUser {
    pub user_id: UserId,
    pub username: String,
    pub role: Role,
    pub online: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Owner,
    Admin,
    Member,
}

impl Role {
    pub fn as_str(&self) -> &'static str {
        match self {
            Role::Owner => "owner",
            Role::Admin => "admin",
            Role::Member => "member",
        }
    }

    pub fn rank(&self) -> u8 {
        match self {
            Role::Owner => 3,
            Role::Admin => 2,
            Role::Member => 1,
        }
    }

    pub fn allows(&self, required: Role) -> bool {
        self.rank() >= required.rank()
    }
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for Role {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "owner" => Ok(Role::Owner),
            "admin" => Ok(Role::Admin),
            "member" => Ok(Role::Member),
            _ => Err(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_parsing() {
        assert_eq!(Role::from_str("owner").unwrap(), Role::Owner);
        assert!(Role::from_str("unknown").is_err());
    }

    #[test]
    fn role_allows() {
        assert!(Role::Owner.allows(Role::Admin));
        assert!(!Role::Member.allows(Role::Admin));
    }
}
