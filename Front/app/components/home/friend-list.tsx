import Link from 'next/link';
import { lusitana } from '@/lib/fonts';
import type { UserPublic } from '@/lib/friend-actions';

type FriendListProps = {
    friends: UserPublic[];
};

const statusStyles: Record<string, { label: string; dot: string }> = {
    online: { label: 'Online', dot: 'bg-emerald-500' },
    offline: { label: 'Offline', dot: 'bg-slate-400' },
    dnd: { label: 'Do Not Disturb', dot: 'bg-red-500' },
};

function getStatus(status?: string) {
    if (!status) {
        return statusStyles.offline;
    }
    return statusStyles[status] ?? statusStyles.offline;
}

export default function FriendList({ friends }: FriendListProps) {
    return (
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
                        No friends yet. Add a friend to start chatting.
                    </p>
                ) : (
                    friends.map((friend) => {
                        const status = getStatus(friend.status);
                        return (
                            <Link
                                key={friend.id}
                                href={`/home/${friend.id}`}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative h-10 w-10">
                                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900" />
                                        <span
                                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${status.dot}`}
                                        />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-slate-800">
                                            {friend.username}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {status.label}
                                        </div>
                                    </div>
                                </div>
                                <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                                    Message
                                </span>
                            </Link>
                        );
                    })
                )}
            </div>
        </section>
    );
}
