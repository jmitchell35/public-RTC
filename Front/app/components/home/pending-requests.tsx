import { lusitana } from '@/lib/fonts';
import type { FriendRequestsResponse } from '@/lib/friend-actions';
import { acceptFriendRequest, rejectFriendRequest } from '@/lib/friend-actions';

type PendingRequestsProps = {
    requests: FriendRequestsResponse;
};

export default function PendingRequests({ requests }: PendingRequestsProps) {
    const pendingCount = requests.incoming.length + requests.outgoing.length;

    return (
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
    );
}
