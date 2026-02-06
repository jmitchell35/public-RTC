import HomeClient from '@/components/home/home-client';
import { getFriendRequests, getFriends, getMe } from '@/lib/friend-actions';

export default async function HomePage() {
    const [meResponse, friends, requests] = await Promise.all([
        getMe(),
        getFriends(),
        getFriendRequests(),
    ]);

    return (
        <HomeClient
            initialMe={meResponse?.user ?? null}
            initialFriends={friends}
            initialRequests={requests}
            initialTab="friends"
        />
    );
}
