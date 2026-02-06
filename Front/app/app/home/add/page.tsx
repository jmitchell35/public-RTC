import AddFriendForm from '@/components/home/add-friend-form';
import HomeShell from '@/components/home/home-shell';
import PendingRequests from '@/components/home/pending-requests';
import { lusitana } from '@/lib/fonts';
import { getFriendRequests, getFriends, getMe } from '@/lib/friend-actions';

export default async function AddFriendPage() {
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
            activeTab="add"
        >
            <section className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2">
                    <h2 className={`${lusitana.className} text-lg`}>
                        Add Friend
                    </h2>
                    <p className="text-sm text-slate-500">
                        Use a friend code to send a request. Share yours to connect faster.
                    </p>
                </div>
                <div className="mt-4">
                    <AddFriendForm friendCode={meResponse?.user.friend_code} />
                </div>
            </section>
            <PendingRequests requests={requests} />
        </HomeShell>
    );
}
