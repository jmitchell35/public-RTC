'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { authFetch } from './auth-fetch';
import type { DirectMessagesResponse } from './types';

const messageSchema = z.object({
    friendId: z.string().uuid(),
    content: z.string().min(1).max(2000),
});

export async function getDirectMessages(
    friendId: string,
    options?: { limit?: number; before?: string },
) {
    const params = new URLSearchParams();
    if (options?.limit) {
        params.set('limit', String(options.limit));
    }
    if (options?.before) {
        params.set('before', options.before);
    }
    const query = params.toString();
    const response = await authFetch(`/dm/${friendId}${query ? `?${query}` : ''}`, {
        method: 'GET',
    });
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

    revalidatePath(`/home/dm/${parsed.data.friendId}`);
    return undefined;
}
