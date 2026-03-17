import DirectMessageClient from '@/components/home/direct-message-client';

type RouteParams = {
    params: { id: string } | Promise<{ id: string }>;
};

export default async function DirectMessagePage({ params }: RouteParams) {
    const { id } = await params;
    return <DirectMessageClient friendId={id} />;
}
