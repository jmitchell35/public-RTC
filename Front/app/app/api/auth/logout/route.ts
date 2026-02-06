import { forwardBackend } from '@/app/api/_utils';

export async function POST() {
    const response = await forwardBackend('/auth/logout', { method: 'POST' });
    response.cookies.set('auth_token', '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 0,
        path: '/',
    });
    return response;
}
