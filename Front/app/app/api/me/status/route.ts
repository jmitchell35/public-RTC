import { forwardBackend } from '@/app/api/_utils';

export async function POST(request: Request) {
    const payload = await request.json();
    return forwardBackend('/me/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}
