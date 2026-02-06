import { forwardBackend } from '@/app/api/_utils';

type RouteParams = {
    params: { id: string } | Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
    const { id } = await params;
    return forwardBackend(`/servers/${id}`, { method: 'GET' });
}

export async function PUT(request: Request, { params }: RouteParams) {
    const { id } = await params;
    const payload = await request.json();
    return forwardBackend(`/servers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
    const { id } = await params;
    return forwardBackend(`/servers/${id}`, { method: 'DELETE' });
}
