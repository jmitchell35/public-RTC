import Link from 'next/link';
import type { FriendRequestsResponse, UserPublic } from '@/lib/friend-actions';
import { updateStatus } from '@/lib/friend-actions';
// import ServerBar from '@/components/server_bar';
import {
    ChatBubbleLeftRightIcon,
    MagnifyingGlassIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';

type HomeShellProps = {
    me: UserPublic | null;
    friends: UserPublic[];
    requests: FriendRequestsResponse;
    activeTab: 'friends' | 'add';
    children: React.ReactNode;
};

const statusStyles: Record<
    string,
    { label: string; dot: string; pill: string }
> = {
    online: {
        label: 'Online',
        dot: 'bg-emerald-500',
        pill: 'bg-emerald-100 text-emerald-700',
    },
    offline: {
        label: 'Offline',
        dot: 'bg-slate-400',
        pill: 'bg-slate-100 text-slate-600',
    },
    dnd: {
        label: 'Do Not Disturb',
        dot: 'bg-red-500',
        pill: 'bg-red-100 text-red-600',
    },
};

function getStatus(status?: string) {
    if (!status) {
        return statusStyles.offline;
    }
    return statusStyles[status] ?? statusStyles.offline;
}

export default function HomeShell({
    me,
    friends,
    requests,
    activeTab,
    children,
}: HomeShellProps) {
    const status = getStatus(me?.status);
    const pendingCount = requests.incoming.length + requests.outgoing.length;
    const onlineFriends = friends.filter((friend) => friend.status === 'online');

    return (
        <main className="flex min-h-screen bg-[#eef2f7] text-slate-900">
            <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white/90 md:flex md:flex-col">
                <div className="px-4 py-4">
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                        <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
                        Search DMs
                    </div>
                </div>
                <nav className="flex flex-1 flex-col gap-1 px-3 pb-4 text-sm">
                    <Link
                        href="/home"
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                            activeTab === 'friends'
                                ? 'bg-blue-500/10 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <UsersIcon className="h-5 w-5" />
                        Friends
                    </Link>
                    <Link
                        href="/home/add"
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                            activeTab === 'add'
                                ? 'bg-blue-500/10 text-blue-700'
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <ChatBubbleLeftRightIcon className="h-5 w-5" />
                        Add Friend
                    </Link>
                    <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Direct Messages
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                        {friends.length === 0 ? (
                            <span className="px-3 py-2 text-xs text-slate-400">
                                No direct messages yet.
                            </span>
                        ) : (
                            friends.map((friend) => {
                                const friendStatus = getStatus(friend.status);
                                return (
                                    <Link
                                        key={friend.id}
                                        href={`/home/${friend.id}`}
                                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
                                    >
                                        <div className="relative h-8 w-8">
                                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900" />
                                            <span
                                                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${friendStatus.dot}`}
                                            />
                                        </div>
                                        <span>{friend.username}</span>
                                    </Link>
                                );
                            })
                        )}
                    </div>
                </nav>
                <div className="border-t border-slate-200 px-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="relative h-9 w-9">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900" />
                            <span
                                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${status.dot}`}
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">
                                {me?.username ?? 'Unknown user'}
                            </div>
                            <div className="text-xs text-slate-500">
                                {status.label}
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {['online', 'dnd', 'offline'].map((value) => {
                            const option = getStatus(value);
                            return (
                                <form action={updateStatus} key={value}>
                                    <input
                                        type="hidden"
                                        name="status"
                                        value={value}
                                    />
                                    <button
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                            me?.status === value
                                                ? option.pill
                                                : 'bg-white text-slate-500 hover:bg-slate-100'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                </form>
                            );
                        })}
                    </div>
                </div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <UsersIcon className="h-5 w-5 text-blue-500" />
                        Friends
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                        <Link
                            href="/home"
                            className={`rounded-full px-3 py-1 ${
                                activeTab === 'friends'
                                    ? 'bg-slate-900 text-white'
                                    : 'hover:bg-slate-100'
                            }`}
                        >
                            All
                        </Link>
                        <span className="rounded-full px-3 py-1 text-slate-400">
                            Online {onlineFriends.length > 0 ? `(${onlineFriends.length})` : ''}
                        </span>
                        <span className="rounded-full px-3 py-1 text-slate-400">
                            Pending {pendingCount > 0 ? `(${pendingCount})` : ''}
                        </span>
                        <Link
                            href="/home/add"
                            className={`rounded-full px-3 py-1 ${
                                activeTab === 'add'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20'
                            }`}
                        >
                            Add Friend
                        </Link>
                    </div>
                </header>

                <div className="flex flex-1 flex-col lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-6 p-6">
                        {children}
                    </div>
                    <aside className="hidden w-80 shrink-0 border-l border-slate-200 bg-white/90 p-6 lg:block">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-500" />
                            Active Now
                        </div>
                        <div className="mt-4 space-y-3">
                            {onlineFriends.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                                    No friends are online right now.
                                </div>
                            ) : (
                                onlineFriends.map((friend) => (
                                    <Link
                                        key={friend.id}
                                        href={`/home/${friend.id}`}
                                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500" />
                                            <div>
                                                <div className="font-semibold">
                                                    {friend.username}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Online now
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </aside>
                </div>
            </section>
        </main>
    );
}
