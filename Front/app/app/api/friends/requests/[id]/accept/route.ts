import { forwardBackend } from '@/app/api/_utils';

type RouteParams = {
    params: { id: string } | Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteParams) {
    const { id } = await params;
    return forwardBackend(`/friends/requests/${id}/accept`, {
        method: 'POST',
    });
}
