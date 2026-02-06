import DirectMessageClient from '@/components/home/direct-message-client';

type DirectMessagePageProps = {
    params: { id: string } | Promise<{ id: string }>;
};

export default async function DirectMessagePage({
    params,
}: DirectMessagePageProps) {
    const { id } = await params;
    return <DirectMessageClient friendId={id} />;
}
