import { forwardBackend } from '@/app/api/_utils';

export async function GET() {
    return forwardBackend('/friends/requests', { method: 'GET' });
}

export async function POST(request: Request) {
    const payload = await request.json();
    return forwardBackend('/friends/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}
