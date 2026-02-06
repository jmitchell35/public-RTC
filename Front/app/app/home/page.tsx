import HomeShell from '@/components/home/home-shell';
import FriendList from '@/components/home/friend-list';
import PendingRequests from '@/components/home/pending-requests';
import { getFriendRequests, getFriends, getMe } from '@/lib/friend-actions';

export default async function HomePage() {
    const [meResponse, friends, requests] = await Promise.all([
        getMe(),
        getFriends(),
        getFriendRequests(),
    ]);

    return (
        <HomeShell
            me={meResponse?.user ?? null}
            friends={friends}
            requests={requests}
            activeTab="friends"
        >
            <FriendList friends={friends} />
            <PendingRequests requests={requests} />
        </HomeShell>
    );
}
