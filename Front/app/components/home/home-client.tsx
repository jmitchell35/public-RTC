'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AddFriendForm from '@/components/home/add-friend-form';
import FriendList from '@/components/home/friend-list';
import PendingRequests from '@/components/home/pending-requests';
import { lusitana } from '@/lib/fonts';
import type {
    FriendRequestItem,
    FriendRequestsResponse,
    UserPublic,
} from '@/lib/types';
import { useHomeWs } from '@/components/home/home-ws-provider';
// import ServerBar from '@/components/server_bar';

type HomeClientProps = {
    initialMe: UserPublic | null;
    initialFriends: UserPublic[];
    initialRequests: FriendRequestsResponse;
    initialTab?: 'friends' | 'add';
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

const STATUS_OPTIONS = ['online', 'dnd', 'offline'] as const;

function getStatus(status?: string) {
    if (!status) {
        return statusStyles.offline;
    }
    return statusStyles[status] ?? statusStyles.offline;
}

function sortByUsername(list: UserPublic[]) {
    return [...list].sort((a, b) => a.username.localeCompare(b.username));
}

function upsertFriend(list: UserPublic[], friend: UserPublic) {
    const existing = list.find((item) => item.id === friend.id);
    if (existing) {
        return list.map((item) =>
            item.id === friend.id ? friend : item,
        );
    }
    return sortByUsername([...list, friend]);
}

function upsertRequest(list: FriendRequestItem[], request: FriendRequestItem) {
    if (list.some((item) => item.id === request.id)) {
        return list;
    }
    return [request, ...list].sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    );
}

function removeRequest(list: FriendRequestItem[], requestId: string) {
    return list.filter((item) => item.id !== requestId);
}

function updateRequestStatuses(
    list: FriendRequestItem[],
    user: UserPublic,
) {
    return list.map((item) =>
        item.user.id === user.id
            ? { ...item, user: { ...item.user, status: user.status } }
            : item,
    );
}

export default function HomeClient({
    initialMe,
    initialFriends,
    initialRequests,
    initialTab = 'friends',
}: HomeClientProps) {
    const router = useRouter();
    const ws = useHomeWs();
    const [me, setMe] = useState<UserPublic | null>(initialMe);
    const [friends, setFriends] = useState<UserPublic[]>(
        sortByUsername(initialFriends),
    );
    const [requests, setRequests] =
        useState<FriendRequestsResponse>(initialRequests);
    const [activeTab, setActiveTab] = useState<'friends' | 'add'>(
        initialTab ?? 'friends',
    );
    const [statusError, setStatusError] = useState<string | null>(null);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>(
        {},
    );
    const [lastNotification, setLastNotification] = useState<{
        friendId: string;
        content: string;
    } | null>(null);

    const pendingCount = requests.incoming.length + requests.outgoing.length;
    const onlineCount = useMemo(
        () => friends.filter((friend) => friend.status === 'online').length,
        [friends],
    );

    useEffect(() => {
        if (!ws) {
            return;
        }
        return ws.addListener((wsEvent) => {
            switch (wsEvent.type) {
                case 'FriendRequestCreated': {
                    const { direction, request } = wsEvent.data;
                    setRequests((prev) => {
                        if (direction === 'incoming') {
                            return {
                                ...prev,
                                incoming: upsertRequest(
                                    prev.incoming,
                                    request,
                                ),
                            };
                        }
                        return {
                            ...prev,
                            outgoing: upsertRequest(
                                prev.outgoing,
                                request,
                            ),
                        };
                    });
                    break;
                }
                case 'FriendRequestAccepted': {
                    const { request_id, friend } = wsEvent.data;
                    setFriends((prev) => upsertFriend(prev, friend));
                    setRequests((prev) => ({
                        incoming: removeRequest(prev.incoming, request_id),
                        outgoing: removeRequest(prev.outgoing, request_id),
                    }));
                    break;
                }
                case 'FriendRequestRemoved': {
                    const { request_id } = wsEvent.data;
                    setRequests((prev) => ({
                        incoming: removeRequest(prev.incoming, request_id),
                        outgoing: removeRequest(prev.outgoing, request_id),
                    }));
                    break;
                }
                case 'FriendStatusUpdated': {
                    const { user } = wsEvent.data;
                    setFriends((prev) =>
                        prev.some((friend) => friend.id === user.id)
                            ? prev.map((friend) =>
                                  friend.id === user.id ? user : friend,
                              )
                            : prev,
                    );
                    setRequests((prev) => ({
                        incoming: updateRequestStatuses(prev.incoming, user),
                        outgoing: updateRequestStatuses(prev.outgoing, user),
                    }));
                    if (me?.id === user.id) {
                        setMe(user);
                    }
                    break;
                }
                case 'DirectMessage': {
                    const { friend_id, message } = wsEvent.data;
                    if (message.author_id === me?.id) {
                        return;
                    }
                    setUnreadCounts((prev) => ({
                        ...prev,
                        [friend_id]: (prev[friend_id] ?? 0) + 1,
                    }));
                    setLastNotification({
                        friendId: friend_id,
                        content: message.content,
                    });
                    break;
                }
                default:
                    break;
            }
        });
    }, [ws, me?.id]);

    if (!me) {
        return (
            <main className="min-h-screen bg-[#eef2f7] text-slate-900">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-16 text-center">
                    <h1 className={`${lusitana.className} text-2xl`}>
                        Session expired
                    </h1>
                    <p className="text-sm text-slate-500">
                        Please sign in again to view your friends.
                    </p>
                </div>
            </main>
        );
    }

    const status = getStatus(me.status);

    const sendFriendRequest = async (friendCode: string) => {
        try {
            const response = await fetch('/api/friends/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    friend_code: friendCode.trim().toLowerCase(),
                }),
            });
            if (!response.ok) {
                if (response.status === 409) {
                    return 'Friend request already exists.';
                }
                if (response.status === 404) {
                    return 'User not found.';
                }
                if (response.status === 400) {
                    return 'Invalid friend code.';
                }
                if (response.status === 401) {
                    return 'Please log in again.';
                }
                return 'Something went wrong.';
            }

            const data = (await response.json()) as {
                request: FriendRequestItem;
            };
            if (data?.request) {
                setRequests((prev) => ({
                    ...prev,
                    outgoing: upsertRequest(prev.outgoing, data.request),
                }));
            }
            return null;
        } catch (error) {
            console.error('Friend request failed', error);
            return 'Backend unreachable. Start the backend and check BACKEND_URL.';
        }
    };

    const acceptRequest = async (requestId: string) => {
        try {
            const response = await fetch(
                `/api/friends/requests/${requestId}/accept`,
                {
                    method: 'POST',
                },
            );
            if (!response.ok) {
                return;
            }
            const data = (await response.json()) as { friend?: UserPublic };
            if (data?.friend) {
                setFriends((prev) => upsertFriend(prev, data.friend));
            }
            setRequests((prev) => ({
                incoming: removeRequest(prev.incoming, requestId),
                outgoing: removeRequest(prev.outgoing, requestId),
            }));
        } catch (error) {
            console.error('Accept friend request failed', error);
        }
    };

    const rejectRequest = async (requestId: string) => {
        try {
            const response = await fetch(
                `/api/friends/requests/${requestId}`,
                {
                    method: 'DELETE',
                },
            );
            if (!response.ok) {
                return;
            }
            setRequests((prev) => ({
                incoming: removeRequest(prev.incoming, requestId),
                outgoing: removeRequest(prev.outgoing, requestId),
            }));
        } catch (error) {
            console.error('Reject friend request failed', error);
        }
    };

    const updateStatus = async (nextStatus: string) => {
        if (me.status === nextStatus) {
            return;
        }
        const previousStatus = me.status;
        setMe((prev) => (prev ? { ...prev, status: nextStatus } : prev));
        setStatusError(null);
        try {
            const response = await fetch('/api/me/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus }),
            });
            if (!response.ok) {
                setMe((prev) =>
                    prev ? { ...prev, status: previousStatus } : prev,
                );
                setStatusError('Status update failed.');
                return;
            }
            const data = (await response.json()) as { user?: UserPublic };
            if (data?.user) {
                setMe(data.user);
            }
        } catch (error) {
            console.error('Status update failed', error);
            setMe((prev) =>
                prev ? { ...prev, status: previousStatus } : prev,
            );
            setStatusError('Backend unreachable.');
        }
    };

    const handleOpenFriend = (friendId: string) => {
        setUnreadCounts((prev) => ({
            ...prev,
            [friendId]: 0,
        }));
        if (lastNotification?.friendId === friendId) {
            setLastNotification(null);
        }
    };

    const notificationFriend = lastNotification
        ? friends.find((friend) => friend.id === lastNotification.friendId)
        : null;

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout failed', error);
        } finally {
            router.replace('/login');
        }
    };

    return (
        <main className="min-h-screen bg-[#eef2f7] text-slate-900">
            <header className="border-b border-slate-200 bg-white/90">
                <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
                    <div className="space-y-1">
                        <h1 className={`${lusitana.className} text-2xl`}>
                            Friends
                        </h1>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                                Online {onlineCount > 0 ? `(${onlineCount})` : ''}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                                Pending {pendingCount > 0 ? `(${pendingCount})` : ''}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <Link
                            href="/settings"
                            className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-slate-50"
                            aria-label="Open settings"
                        >
                            <div className="relative h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900" />
                                <span
                                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${status.dot}`}
                                />
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-800">
                                    {me.username}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {status.label}
                                </div>
                            </div>
                        </Link>
                        <div className="flex flex-wrap items-center gap-2">
                            {STATUS_OPTIONS.map((value) => {
                                const option = getStatus(value);
                                return (
                                    <button
                                        key={value}
                                        onClick={() => updateStatus(value)}
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                            me.status === value
                                                ? option.pill
                                                : 'bg-white text-slate-500 hover:bg-slate-100'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                            <button
                                onClick={handleLogout}
                                className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
                {statusError && (
                    <div className="mx-auto flex w-full max-w-6xl px-6 pb-4 text-xs text-red-500">
                        {statusError}
                    </div>
                )}
            </header>

            <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
                {lastNotification && notificationFriend && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                        <div>
                            New message from{' '}
                            <span className="font-semibold">
                                {notificationFriend.username}
                            </span>
                            : {lastNotification.content}
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/home/${notificationFriend.id}`}
                                onClick={() => {
                                    handleOpenFriend(notificationFriend.id);
                                    setLastNotification(null);
                                }}
                                className="rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-400"
                            >
                                View
                            </Link>
                            <button
                                onClick={() => setLastNotification(null)}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
                    <button
                        onClick={() => setActiveTab('friends')}
                        className={`rounded-full px-4 py-2 ${
                            activeTab === 'friends'
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        Friends
                    </button>
                    <button
                        onClick={() => setActiveTab('add')}
                        className={`rounded-full px-4 py-2 ${
                            activeTab === 'add'
                                ? 'bg-blue-500 text-white'
                                : 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20'
                        }`}
                    >
                        Add Friend
                    </button>
                </div>

                {activeTab === 'friends' ? (
                    <div className="flex flex-col gap-6">
                        <FriendList
                            friends={friends}
                            unreadCounts={unreadCounts}
                            onOpenFriend={handleOpenFriend}
                        />
                        <PendingRequests
                            requests={requests}
                            onAccept={acceptRequest}
                            onReject={rejectRequest}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        <section className="rounded-2xl bg-white p-6 shadow-sm">
                            <div className="flex flex-col gap-2">
                                <h2 className={`${lusitana.className} text-lg`}>
                                    Add Friend
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Use a friend code to send a request. Share yours
                                    to connect faster.
                                </p>
                            </div>
                            <div className="mt-4">
                                <AddFriendForm
                                    friendCode={me.friend_code}
                                    onSendRequest={sendFriendRequest}
                                />
                            </div>
                        </section>
                        <PendingRequests
                            requests={requests}
                            onAccept={acceptRequest}
                            onReject={rejectRequest}
                        />
                    </div>
                )}
            </section>
        </main>
    );
}
