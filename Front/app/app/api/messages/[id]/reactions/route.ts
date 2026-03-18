import { forwardBackend } from '@/app/api/_utils';

type RouteParams = {
    params: { id: string } | Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
    const { id } = await params;
    return forwardBackend(`/messages/${id}/reactions`, { method: 'GET' });
}

export async function POST(request: Request, { params }: RouteParams) {
    const { id } = await params;
    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        console.error('[reactions POST] failed to parse request body');
        return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400 });
    }
    console.log(`[reactions POST] message=${id} payload=`, payload);
    const res = await forwardBackend(`/messages/${id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    console.log(`[reactions POST] backend status=${res.status}`);
    return res;
}

export async function DELETE(request: Request, { params }: RouteParams) {
    const { id } = await params;
    const payload = await request.json();
    return forwardBackend(`/messages/${id}/reactions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}
