'use client';

import { useTranslation } from 'react-i18next';
import type { ServerMember } from '@/lib/types';

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
        <aside className="home-members">
            <div className="home-members-title">
                {t('server.members')}
                <span className="home-members-count">{members.length}</span>
            </div>
            <div className="home-members-list">
                {members.map((member) => (
                    <div key={member.user_id} className="home-member-item">
                        <div className="home-member-avatar">
                            {member.username[0]?.toUpperCase() ?? 'U'}
                        </div>
                        <div className="home-member-meta">
                            <div className="home-member-line">
                                <span className="home-member-name">{member.username}</span>
                                <span className={`home-member-role home-member-role-${member.role}`}>
                                    {member.role}
                                </span>
                            </div>
                            <span
                                className={`home-member-status home-member-status-${
                                    member.online ? member.status || 'online' : 'offline'
                                }`}
                            >
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
                                className="home-member-add"
                                type="button"
                                onClick={() => onAddFriend(member)}
                                disabled={addingFriendId === member.user_id}
                                title={t('server.add_friend_title')}
                            >
                                +
                            </button>
                        ) : null}
                    </div>
                ))}
            </div>
        </aside>
    );
}
