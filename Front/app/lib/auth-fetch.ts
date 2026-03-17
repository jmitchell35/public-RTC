'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchBackend } from './backend';

export async function authFetch(path: string, init: RequestInit) {
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
