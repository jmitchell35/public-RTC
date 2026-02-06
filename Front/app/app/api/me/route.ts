import { forwardBackend } from '@/app/api/_utils';

export async function GET() {
    return forwardBackend('/me', { method: 'GET' });
}
