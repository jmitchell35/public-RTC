'use server';

import { z } from 'zod';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { fetchBackend } from './backend';
import type { DirectMessagesResponse } from './types';

const messageSchema = z.object({
    friendId: z.string().uuid(),
    content: z.string().min(1).max(2000),
});

async function authFetch(path: string, init: RequestInit) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
        redirect('/login');
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);

    const { response } = await fetchBackend(path, {
        ...init,
        headers,
        cache: 'no-store',
    });

    return response;
}

export async function getDirectMessages(friendId: string) {
    const response = await authFetch(`/dm/${friendId}`, { method: 'GET' });
    if (response.status === 401) {
        redirect('/login');
    }
    if (response.status === 403 || response.status === 404) {
        redirect('/home');
    }
    if (!response.ok) {
        return null;
    }
    return response.json() as Promise<DirectMessagesResponse>;
}

export async function sendDirectMessage(
    _prevState: string | undefined,
    formData: FormData,
) {
    const parsed = messageSchema.safeParse({
        friendId: formData.get('friendId'),
        content: formData.get('content'),
    });

    if (!parsed.success) {
        return 'Message cannot be empty.';
    }

    const content = parsed.data.content.trim();
    if (!content) {
        return 'Message cannot be empty.';
    }

    try {
        const response = await authFetch(`/dm/${parsed.data.friendId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
        if (!response.ok) {
            return 'Something went wrong.';
        }
    } catch (error) {
        console.error('Direct message send failed', error);
        return 'Backend unreachable. Start the backend and check BACKEND_URL.';
    }

    revalidatePath(`/home/${parsed.data.friendId}`);
    return undefined;
}
