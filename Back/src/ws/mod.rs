use crate::models::{DirectMessage, Message, UserPublic};
use chrono::{DateTime, Utc};
use dashmap::{DashMap, DashSet};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use uuid::Uuid;

pub mod handler;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsEvent {
    Message { message: Message },
    MessageUpdated { message: Message },
    MessageDeleted { channel_id: Uuid, message_id: Uuid },
    UserConnected { server_id: Uuid, user: UserPublic },
    UserDisconnected { server_id: Uuid, user_id: Uuid },
    Typing { channel_id: Uuid, user_id: Uuid, is_typing: bool },
    Notification { server_id: Uuid, content: String },
    MessagePinned { message_id: Uuid, pinned: bool },
    ReactionAdded { message_id: Uuid, reaction: crate::models::MessageReaction },
    ReactionRemoved { message_id: Uuid, user_id: Uuid, emoji: String },
    FriendRequestCreated { direction: String, request: FriendRequestPayload },
    FriendRequestAccepted { request_id: Uuid, friend: UserPublic },
    FriendRequestRemoved { request_id: Uuid },
    FriendStatusUpdated { user: UserPublic },
    DirectMessage { friend_id: Uuid, message: DirectMessage },
    DirectMessageUpdated { friend_id: Uuid, message: DirectMessage },
    DirectMessageDeleted { friend_id: Uuid, message_id: Uuid },
    DirectTyping { friend_id: Uuid, is_typing: bool },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsInbound {
    JoinChannel { channel_id: Uuid },
    LeaveChannel { channel_id: Uuid },
    SendMessage { channel_id: Uuid, content: String },
    Typing { channel_id: Uuid, is_typing: bool },
    SubscribeServer { server_id: Uuid },
    UnsubscribeServer { server_id: Uuid },
    DirectTyping { friend_id: Uuid, is_typing: bool },
    Ping,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendRequestPayload {
    pub id: Uuid,
    pub user: UserPublic,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct WsHub {
    channel_broadcast: DashMap<Uuid, broadcast::Sender<WsEvent>>,
    server_broadcast: DashMap<Uuid, broadcast::Sender<WsEvent>>,
    user_broadcast: DashMap<Uuid, broadcast::Sender<WsEvent>>,
}

impl WsHub {
    pub fn new() -> Self {
        Self {
            channel_broadcast: DashMap::new(),
            server_broadcast: DashMap::new(),
            user_broadcast: DashMap::new(),
        }
    }

    pub fn channel_sender(&self, channel_id: Uuid) -> broadcast::Sender<WsEvent> {
        self.channel_broadcast
            .entry(channel_id)
            .or_insert_with(|| {
                let (tx, _) = broadcast::channel(512);
                tx
            })
            .clone()
    }

    pub fn server_sender(&self, server_id: Uuid) -> broadcast::Sender<WsEvent> {
        self.server_broadcast
            .entry(server_id)
            .or_insert_with(|| {
                let (tx, _) = broadcast::channel(512);
                tx
            })
            .clone()
    }

    pub fn user_sender(&self, user_id: Uuid) -> broadcast::Sender<WsEvent> {
        self.user_broadcast
            .entry(user_id)
            .or_insert_with(|| {
                let (tx, _) = broadcast::channel(256);
                tx
            })
            .clone()
    }

    pub fn broadcast_channel(&self, channel_id: Uuid, event: WsEvent) {
        let _ = self.channel_sender(channel_id).send(event);
    }

    pub fn broadcast_server(&self, server_id: Uuid, event: WsEvent) {
        let _ = self.server_sender(server_id).send(event);
    }

    pub fn broadcast_user(&self, user_id: Uuid, event: WsEvent) {
        let _ = self.user_sender(user_id).send(event);
    }
}

#[derive(Clone)]
pub struct PresenceState {
    online_by_server: DashMap<Uuid, DashSet<Uuid>>,
    typing_by_channel: DashMap<Uuid, DashSet<Uuid>>,
}

impl PresenceState {
    pub fn new() -> Self {
        Self {
            online_by_server: DashMap::new(),
            typing_by_channel: DashMap::new(),
        }
    }

    pub fn set_online(&self, server_id: Uuid, user_id: Uuid, online: bool) {
        if online {
            self.online_by_server
                .entry(server_id)
                .or_insert_with(DashSet::new)
                .insert(user_id);
        } else if let Some(set) = self.online_by_server.get(&server_id) {
            set.remove(&user_id);
        }
    }

    pub fn is_online(&self, server_id: Uuid, user_id: Uuid) -> bool {
        self.online_by_server
            .get(&server_id)
            .map(|set| set.contains(&user_id))
            .unwrap_or(false)
    }

    pub fn set_typing(&self, channel_id: Uuid, user_id: Uuid, typing: bool) {
        if typing {
            self.typing_by_channel
                .entry(channel_id)
                .or_insert_with(DashSet::new)
                .insert(user_id);
        } else if let Some(set) = self.typing_by_channel.get(&channel_id) {
            set.remove(&user_id);
        }
    }

    pub fn is_typing(&self, channel_id: Uuid, user_id: Uuid) -> bool {
        self.typing_by_channel
            .get(&channel_id)
            .map(|set| set.contains(&user_id))
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presence_updates() {
        let presence = PresenceState::new();
        let server = Uuid::new_v4();
        let user = Uuid::new_v4();
        assert!(!presence.is_online(server, user));
        presence.set_online(server, user, true);
        assert!(presence.is_online(server, user));
        presence.set_online(server, user, false);
        assert!(!presence.is_online(server, user));
    }
}
