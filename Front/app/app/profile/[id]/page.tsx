import ProfileClient from '@/components/profile/profile-client';

type ProfilePageProps = {
    params: { id: string } | Promise<{ id: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
    const { id } = await params;
    return <ProfileClient userId={id} />;
}
