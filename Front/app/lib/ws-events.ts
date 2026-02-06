import type {
    ChannelMessage,
    DirectMessage,
    FriendRequestItem,
    UserPublic,
} from './types';

export type WsEvent =
    | {
          type: 'Message';
          data: { message: ChannelMessage };
      }
    | {
          type: 'MessageUpdated';
          data: { message: ChannelMessage };
      }
    | {
          type: 'MessageDeleted';
          data: { channel_id: string; message_id: string };
      }
    | {
          type: 'Typing';
          data: { channel_id: string; user_id: string; is_typing: boolean };
      }
    | {
          type: 'UserConnected';
          data: { server_id: string; user: UserPublic };
      }
    | {
          type: 'UserDisconnected';
          data: { server_id: string; user_id: string };
      }
    | {
          type: 'Notification';
          data: { server_id: string; content: string };
      }
    | {
          type: 'MessagePinned';
          data: { message_id: string; pinned: boolean };
      }
    | {
          type: 'ReactionAdded';
          data: {
              message_id: string;
              reaction: {
                  message_id: string;
                  user_id: string;
                  emoji: string;
                  created_at: string;
              };
          };
      }
    | {
          type: 'ReactionRemoved';
          data: { message_id: string; user_id: string; emoji: string };
      }
    | {
          type: 'FriendRequestCreated';
          data: { direction: 'incoming' | 'outgoing'; request: FriendRequestItem };
      }
    | {
          type: 'FriendRequestAccepted';
          data: { request_id: string; friend: UserPublic };
      }
    | {
          type: 'FriendRequestRemoved';
          data: { request_id: string };
      }
    | {
          type: 'FriendStatusUpdated';
          data: { user: UserPublic };
      }
    | {
          type: 'DirectMessage';
          data: { friend_id: string; message: DirectMessage };
      }
    | {
          type: 'DirectMessageUpdated';
          data: { friend_id: string; message: DirectMessage };
      }
    | {
          type: 'DirectMessageDeleted';
          data: { friend_id: string; message_id: string };
      }
    | {
          type: 'DirectTyping';
          data: { friend_id: string; is_typing: boolean };
      }
    | {
          type: string;
          data?: unknown;
      };

export function parseWsEvent(payload: string): WsEvent | null {
    try {
        const parsed = JSON.parse(payload) as WsEvent;
        if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}
