export type UserPublic = {
    id: string;
    username: string;
    friend_code: string;
    status: string;
};

export type Server = {
    id: string;
    name: string;
    owner_id: string;
    created_at: string;
};

export type Channel = {
    id: string;
    server_id: string;
    name: string;
    created_at: string;
};

export type ServerMember = {
    user_id: string;
    username: string;
    role: 'owner' | 'admin' | 'member';
    status: string;
    friend_code: string;
    online: boolean;
};

export type ChannelMessage = {
    id: string;
    channel_id: string;
    author_id: string;
    content: string;
    created_at: string;
    edited_at?: string | null;
    pinned?: boolean;
};

export type MessageReaction = {
    message_id: string;
    user_id: string;
    emoji: string;
    created_at: string;
};

export type FriendRequestItem = {
    id: string;
    user: UserPublic;
    created_at: string;
};

export type FriendRequestsResponse = {
    incoming: FriendRequestItem[];
    outgoing: FriendRequestItem[];
};

export type UserProfile = {
    id: string;
    username: string;
    email: string;
    friend_code: string;
    status: string;
    created_at: string;
};

export type DirectMessage = {
    id: string;
    conversation_id: string;
    author_id: string;
    content: string;
    created_at: string;
    edited_at?: string | null;
};

export type DirectMessagesResponse = {
    friend: UserPublic;
    messages: DirectMessage[];
};
