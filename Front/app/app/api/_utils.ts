import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/backend';

export async function forwardBackend(path: string, init: RequestInit) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);

    try {
        const { response } = await fetchBackend(path, {
            ...init,
            headers,
            cache: 'no-store',
        });
        const body = await response.text();
        const proxyHeaders = new Headers();
        const contentType = response.headers.get('content-type');
        if (contentType) {
            proxyHeaders.set('content-type', contentType);
        }
        return new NextResponse(body, {
            status: response.status,
            headers: proxyHeaders,
        });
    } catch (error) {
        console.error('Backend proxy failed', error);
        return NextResponse.json(
            { error: 'Backend unreachable' },
            { status: 502 },
        );
    }
}
