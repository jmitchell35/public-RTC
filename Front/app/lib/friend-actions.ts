'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authFetch } from './auth-fetch';
import type {
    FriendRequestsResponse,
    UserPublic,
} from './types';

const statusSchema = z.object({
    status: z.enum(['online', 'offline', 'dnd']),
});

const friendRequestSchema = z.object({
    friendCode: z.string().min(6).max(32),
});

export async function getMe() {
    const response = await authFetch('/me', { method: 'GET' });
    if (response.status === 401) {
        redirect('/login');
    }
    if (!response.ok) {
        return null;
    }
    return response.json() as Promise<{ user: UserPublic }>;
}

export async function getFriends() {
    const response = await authFetch('/friends', { method: 'GET' });
    if (!response.ok) {
        return [];
    }
    const data = (await response.json()) as { friends: UserPublic[] };
    return data.friends ?? [];
}

export async function getFriendRequests(): Promise<FriendRequestsResponse> {
    const response = await authFetch('/friends/requests', { method: 'GET' });
    if (!response.ok) {
        return { incoming: [], outgoing: [] };
    }
    return response.json() as Promise<FriendRequestsResponse>;
}

export async function sendFriendRequest(
    _prevState: string | undefined,
    formData: FormData,
) {
    const parsed = friendRequestSchema.safeParse({
        friendCode: formData.get('friendCode'),
    });

    if (!parsed.success) {
        return 'Invalid friend code.';
    }

    let response: Response;
    try {
        response = await authFetch('/friends/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                friend_code: parsed.data.friendCode.trim().toLowerCase(),
            }),
        });
    } catch (error) {
        console.error('Friend request failed to reach backend', error);
        return 'Backend unreachable. Start the backend and check BACKEND_URL.';
    }

    if (!response.ok) {
        if (response.status === 409) {
            return 'Friend request already exists.';
        }
        if (response.status === 404) {
            return 'User not found.';
        }
        if (response.status === 400) {
            return 'Invalid friend code.';
        }
        return 'Something went wrong.';
    }

    revalidatePath('/home');
    return undefined;
}

export async function acceptFriendRequest(formData: FormData) {
    const requestId = formData.get('requestId');
    if (!requestId || typeof requestId !== 'string') {
        return;
    }

    try {
        const response = await authFetch(`/friends/requests/${requestId}/accept`, {
            method: 'POST',
        });
        if (!response.ok) {
            return;
        }
    } catch (error) {
        console.error('Accept friend request failed', error);
        return;
    }

    revalidatePath('/home');
}

export async function rejectFriendRequest(formData: FormData) {
    const requestId = formData.get('requestId');
    if (!requestId || typeof requestId !== 'string') {
        return;
    }

    try {
        const response = await authFetch(`/friends/requests/${requestId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            return;
        }
    } catch (error) {
        console.error('Reject friend request failed', error);
        return;
    }

    revalidatePath('/home');
}

export async function updateStatus(formData: FormData) {
    const parsed = statusSchema.safeParse({
        status: formData.get('status'),
    });

    if (!parsed.success) {
        return;
    }

    try {
        const response = await authFetch('/me/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: parsed.data.status,
            }),
        });
        if (!response.ok) {
            return;
        }
    } catch (error) {
        console.error('Status update failed', error);
        return;
    }

    revalidatePath('/home');
}
