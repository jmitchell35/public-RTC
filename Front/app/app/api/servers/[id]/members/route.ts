import { forwardBackend } from '@/app/api/_utils';

type RouteParams = {
    params: { id: string } | Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
    const { id } = await params;
    return forwardBackend(`/servers/${id}/members`, { method: 'GET' });
}
