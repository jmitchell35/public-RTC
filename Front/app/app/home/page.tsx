import { lusitana } from '@/lib/fonts';
import ServerBar from '@/components/server_bar';
import AddFriendForm from '@/components/home/add-friend-form';
import {
    acceptFriendRequest,
    getFriendRequests,
    getFriends,
    getMe,
    rejectFriendRequest,
} from '@/lib/friend-actions';
import {
    ChatBubbleLeftRightIcon,
    InboxIcon,
    SparklesIcon,
    UserPlusIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';

export default async function HomePage() {
    const [meResponse, friends, requests] = await Promise.all([
        getMe(),
        getFriends(),
        getFriendRequests(),
    ]);
    const me = meResponse?.user;
    const pendingCount = requests.incoming.length + requests.outgoing.length;

    return (
        <main className="flex min-h-screen bg-[#eef2f7] text-slate-900">
            <ServerBar />
            <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white/80 md:flex md:flex-col">
                <div className="px-4 py-4">
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                        <SparklesIcon className="h-4 w-4 text-slate-400" />
                        Search DMs
                    </div>
                </div>
                <nav className="flex flex-1 flex-col gap-1 px-3 pb-4 text-sm">
                    <button className="flex items-center gap-3 rounded-lg bg-blue-500/10 px-3 py-2 text-blue-700">
                        <UsersIcon className="h-5 w-5" />
                        Friends
                    </button>
                    <button className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">
                        <InboxIcon className="h-5 w-5" />
                        Message Requests
                    </button>
                    <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Direct Messages
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                        {['Aurora', 'Nox', 'Luna', 'Orion'].map((name) => (
                            <div
                                key={name}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
                            >
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500" />
                                <span>{name}</span>
                            </div>
                        ))}
                    </div>
                </nav>
            </aside>
            <section className="flex min-w-0 flex-1 flex-col">
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <UsersIcon className="h-5 w-5 text-blue-500" />
                        Friends
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                        <button className="rounded-full bg-slate-900 px-3 py-1 text-white">
                            All
                        </button>
                        <button className="rounded-full px-3 py-1 hover:bg-slate-100">
                            Online
                        </button>
                        <button className="rounded-full px-3 py-1 hover:bg-slate-100">
                            Pending
                            {pendingCount > 0 ? ` (${pendingCount})` : ''}
                        </button>
                        <button className="rounded-full px-3 py-1 hover:bg-slate-100">
                            Blocked
                        </button>
                        <button className="rounded-full bg-blue-500 px-3 py-1 text-white">
                            Add Friend
                        </button>
                    </div>
                </header>
                <div className="flex flex-1 flex-col lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-6 p-6">
                        <section className="rounded-2xl bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-2">
                                <h2 className={`${lusitana.className} text-lg`}>
                                    Add Friend
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Send a friend request with their code. Share yours to connect
                                    faster.
                                </p>
                            </div>
                            <div className="mt-4">
                                <AddFriendForm friendCode={me?.friend_code} />
                            </div>
                        </section>

                        <section className="rounded-2xl bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h2 className={`${lusitana.className} text-lg`}>
                                    All Friends
                                </h2>
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    {friends.length} total
                                </span>
                            </div>
                            <div className="mt-4 space-y-3">
                                {friends.length === 0 ? (
                                    <p className="text-sm text-slate-500">
                                        No friends yet. Start a new chat by sending a request.
                                    </p>
                                ) : (
                                    friends.map((friend) => (
                                        <div
                                            key={friend.id}
                                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900" />
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-800">
                                                        {friend.username}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        Code: {friend.friend_code}
                                                    </div>
                                                </div>
                                            </div>
                                            <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                                Message
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        <section className="rounded-2xl bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h2 className={`${lusitana.className} text-lg`}>
                                    Pending Requests
                                </h2>
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    {pendingCount} pending
                                </span>
                            </div>
                            <div className="mt-4 space-y-6">
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Incoming
                                    </h3>
                                    <div className="mt-3 space-y-3">
                                        {requests.incoming.length === 0 ? (
                                            <p className="text-sm text-slate-500">
                                                No incoming requests.
                                            </p>
                                        ) : (
                                            requests.incoming.map((request) => (
                                                <div
                                                    key={request.id}
                                                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500" />
                                                        <div>
                                                            <div className="text-sm font-semibold text-slate-800">
                                                                {request.user.username}
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                Code: {request.user.friend_code}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <form action={acceptFriendRequest}>
                                                            <input
                                                                type="hidden"
                                                                name="requestId"
                                                                value={request.id}
                                                            />
                                                            <button className="rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-400">
                                                                Accept
                                                            </button>
                                                        </form>
                                                        <form action={rejectFriendRequest}>
                                                            <input
                                                                type="hidden"
                                                                name="requestId"
                                                                value={request.id}
                                                            />
                                                            <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                                                Ignore
                                                            </button>
                                                        </form>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Outgoing
                                    </h3>
                                    <div className="mt-3 space-y-3">
                                        {requests.outgoing.length === 0 ? (
                                            <p className="text-sm text-slate-500">
                                                No outgoing requests.
                                            </p>
                                        ) : (
                                            requests.outgoing.map((request) => (
                                                <div
                                                    key={request.id}
                                                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500" />
                                                        <div>
                                                            <div className="text-sm font-semibold text-slate-800">
                                                                {request.user.username}
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                Code: {request.user.friend_code}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <form action={rejectFriendRequest}>
                                                        <input
                                                            type="hidden"
                                                            name="requestId"
                                                            value={request.id}
                                                        />
                                                        <button className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                                            Cancel
                                                        </button>
                                                    </form>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <aside className="hidden w-80 shrink-0 border-l border-slate-200 bg-white/80 p-6 lg:block">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-500" />
                            Active Now
                        </div>
                        <div className="mt-4 space-y-4">
                            {[
                                'Jump into the latest voice hangout.',
                                'Start a new group DM.',
                                'Invite friends to a server.',
                            ].map((text) => (
                                <div
                                    key={text}
                                    className="rounded-2xl border border-slate-200 bg-white p-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-800">
                                            {text}
                                        </span>
                                        <UserPlusIcon className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">
                                        Stay connected with your circle and keep the conversation
                                        going.
                                    </p>
                                </div>
                            ))}
                        </div>
                    </aside>
                </div>
            </section>
        </main>
    );
}
