'use client';

import Link from 'next/link';
import { lusitana } from '@/lib/fonts';
import type { UserPublic } from '@/lib/types';

type FriendListProps = {
    friends: UserPublic[];
    unreadCounts?: Record<string, number>;
    onOpenFriend?: (friendId: string) => void;
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

export default function FriendList({
    friends,
    unreadCounts,
    onOpenFriend,
}: FriendListProps) {
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
                        const unread = unreadCounts?.[friend.id] ?? 0;
                        return (
                            <Link
                                key={friend.id}
                                href={`/home/${friend.id}`}
                                onClick={() => onOpenFriend?.(friend.id)}
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
                                <div className="flex items-center gap-2">
                                    {unread > 0 && (
                                        <span className="rounded-full bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white">
                                            {unread}
                                        </span>
                                    )}
                                    <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                                        Message
                                    </span>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
        </section>
    );
}
