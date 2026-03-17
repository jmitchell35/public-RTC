'use client';

import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { ServerMember } from '@/lib/types';

const ROLE_CLASS: Record<string, string> = {
    owner: 'bg-red-100 text-red-700',
    admin: 'bg-blue-100 text-blue-700',
    member: 'bg-slate-200 text-slate-700',
};

const STATUS_CLASS: Record<string, string> = {
    online: 'text-green-600',
    dnd: 'text-orange-500',
    offline: 'text-slate-400',
};

type Props = {
    members: ServerMember[];
    meId: string;
    friendIds: Set<string>;
    outgoingRequestIds: Set<string>;
    incomingRequestIds: Set<string>;
    addingFriendId: string | null;
    onAddFriend: (member: ServerMember) => void;
};

export function MembersPanel({
    members,
    meId,
    friendIds,
    outgoingRequestIds,
    incomingRequestIds,
    addingFriendId,
    onAddFriend,
}: Props) {
    const { t } = useTranslation();

    return (
        <aside className="flex flex-col border-l border-slate-200 bg-white p-4">
            <div className="mb-2.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-gray-500">
                {t('server.members')}
                <span>{members.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {members.map((member) => {
                    const statusKey = member.online ? member.status || 'online' : 'offline';
                    return (
                        <div
                            key={member.user_id}
                            className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-slate-50"
                        >
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 font-bold text-slate-600">
                                {member.username[0]?.toUpperCase() ?? 'U'}
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-950">{member.username}</span>
                                    <span
                                        className={clsx(
                                            'rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em]',
                                            ROLE_CLASS[member.role] ?? ROLE_CLASS.member,
                                        )}
                                    >
                                        {member.role}
                                    </span>
                                </div>
                                <span className={clsx('text-xs', STATUS_CLASS[statusKey] ?? STATUS_CLASS.offline)}>
                                    {member.online
                                        ? t(`status.${member.status || 'online'}`, member.status || 'online')
                                        : t('status.offline')}
                                </span>
                            </div>
                            {member.user_id !== meId &&
                            !friendIds.has(member.user_id) &&
                            !outgoingRequestIds.has(member.user_id) &&
                            !incomingRequestIds.has(member.user_id) ? (
                                <button
                                    className="ml-auto grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-slate-200 bg-white font-bold text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                                    type="button"
                                    onClick={() => onAddFriend(member)}
                                    disabled={addingFriendId === member.user_id}
                                    title={t('server.add_friend_title')}
                                >
                                    +
                                </button>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
