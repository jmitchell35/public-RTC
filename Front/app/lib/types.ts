export type UserPublic = {
    id: string;
    username: string;
    friend_code: string;
    status: string;
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
