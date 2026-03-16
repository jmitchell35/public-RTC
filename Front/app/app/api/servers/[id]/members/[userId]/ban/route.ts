import { forwardBackend } from '@/app/api/_utils';

type RouteParams = {
    params:
        | { id: string; userId: string }
        | Promise<{ id: string; userId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
    const { id, userId } = await params;
    const payload = await request.json();
    return forwardBackend(`/servers/${id}/members/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
    const { id, userId } = await params;
    return forwardBackend(`/servers/${id}/members/${userId}/ban`, {
        method: 'DELETE',
    });
}
