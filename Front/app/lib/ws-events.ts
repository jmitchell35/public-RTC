import type {
    DirectMessage,
    FriendRequestItem,
    UserPublic,
} from './types';

export type WsEvent =
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
