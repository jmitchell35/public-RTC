import { forwardBackend } from '@/app/api/_utils';

type RouteParams = {
    params:
        | { id: string; userId: string }
        | Promise<{ id: string; userId: string }>;
};

export async function PUT(request: Request, { params }: RouteParams) {
    const { id, userId } = await params;
    const payload = await request.json();
    return forwardBackend(`/servers/${id}/members/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}
