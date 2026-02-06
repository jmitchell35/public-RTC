import { forwardBackend } from '@/app/api/_utils';

type RouteParams = {
    params: { id: string } | Promise<{ id: string }>;
};

export async function DELETE(_request: Request, { params }: RouteParams) {
    const { id } = await params;
    return forwardBackend(`/servers/${id}/leave`, { method: 'DELETE' });
}
