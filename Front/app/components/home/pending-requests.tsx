'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lusitana } from '@/lib/fonts';
import type { FriendRequestsResponse } from '@/lib/types';

type PendingRequestsProps = {
    requests: FriendRequestsResponse;
    onAccept: (requestId: string) => Promise<void>;
    onReject: (requestId: string) => Promise<void>;
};

export default function PendingRequests({
    requests,
    onAccept,
    onReject,
}: PendingRequestsProps) {
    const { t } = useTranslation();
    const [pendingIds, setPendingIds] = useState<string[]>([]);
    const pendingCount = requests.incoming.length + requests.outgoing.length;

    const runAction = async (
        requestId: string,
        action: (id: string) => Promise<void>,
    ) => {
        if (pendingIds.includes(requestId)) {
            return;
        }
        setPendingIds((prev) => [...prev, requestId]);
        await action(requestId);
        setPendingIds((prev) => prev.filter((id) => id !== requestId));
    };

    return (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
                <h2 className={`${lusitana.className} text-lg`}>
                    {t('friends.pending_requests')}
                </h2>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t('friends.pending_count', { count: pendingCount })}
                </span>
            </div>
            <div className="mt-4 space-y-6">
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {t('friends.incoming')}
                    </h3>
                    <div className="mt-3 space-y-3">
                        {requests.incoming.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                {t('friends.no_incoming')}
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
                                        <button
                                            onClick={() =>
                                                runAction(request.id, onAccept)
                                            }
                                            disabled={pendingIds.includes(request.id)}
                                            className="rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {t('common.accept')}
                                        </button>
                                        <button
                                            onClick={() =>
                                                runAction(request.id, onReject)
                                            }
                                            disabled={pendingIds.includes(request.id)}
                                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {t('common.ignore')}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {t('friends.outgoing')}
                    </h3>
                    <div className="mt-3 space-y-3">
                        {requests.outgoing.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                {t('friends.no_outgoing')}
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
                                    <button
                                        onClick={() =>
                                            runAction(request.id, onReject)
                                        }
                                        disabled={pendingIds.includes(request.id)}
                                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
