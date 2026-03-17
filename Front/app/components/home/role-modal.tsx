'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerMember } from '@/lib/types';

type Props = {
    members: ServerMember[];
    meId: string;
    isOwner: boolean;
    onClose: () => void;
    onRoleUpdate: (userId: string, role: string) => void;
    onKick: (userId: string) => void;
    onBan: (userId: string, durationMinutes: number | null) => void;
};

export function RoleModal({ members, meId, isOwner, onClose, onRoleUpdate, onKick, onBan }: Props) {
    const { t } = useTranslation();
    const [banningMemberId, setBanningMemberId] = useState<string | null>(null);

    return (
        <div className="home-modal-backdrop" onClick={onClose}>
            <div className="home-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="home-modal-header">
                    <div>
                        <h3 className="home-modal-title">{t('server.roles_title')}</h3>
                        <p className="home-modal-subtitle">{t('server.roles_subtitle')}</p>
                    </div>
                    <button className="home-modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="home-modal-body">
                    {members.map((member) => (
                        <div key={member.user_id} className="home-role-row">
                            <div className="home-role-user">
                                <div className="home-member-avatar">
                                    {member.username[0]?.toUpperCase() ?? 'U'}
                                </div>
                                <div>
                                    <div className="home-member-name">{member.username}</div>
                                    <div className="home-member-role">{member.role}</div>
                                </div>
                            </div>
                            {isOwner && member.user_id !== meId ? (
                                <div className="home-role-actions">
                                    <select
                                        className="home-role-select"
                                        value={member.role}
                                        onChange={(e) => onRoleUpdate(member.user_id, e.target.value)}
                                    >
                                        <option value="member">member</option>
                                        <option value="admin">admin</option>
                                        <option value="owner">owner</option>
                                    </select>
                                    <button
                                        className="home-role-kick"
                                        onClick={() => onKick(member.user_id)}
                                    >
                                        {t('server.kick')}
                                    </button>
                                    {banningMemberId === member.user_id ? (
                                        <div className="home-ban-picker">
                                            <select
                                                className="home-role-select"
                                                defaultValue=""
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    if (v === '') return;
                                                    setBanningMemberId(null);
                                                    onBan(
                                                        member.user_id,
                                                        v === 'permanent' ? null : parseInt(v),
                                                    );
                                                }}
                                            >
                                                <option value="" disabled>
                                                    {t('server.ban_duration_label')}
                                                </option>
                                                <option value="permanent">{t('server.ban_permanent')}</option>
                                                <option value="60">{t('server.ban_1h')}</option>
                                                <option value="1440">{t('server.ban_24h')}</option>
                                                <option value="10080">{t('server.ban_7d')}</option>
                                                <option value="43200">{t('server.ban_30d')}</option>
                                            </select>
                                            <button
                                                className="home-role-kick"
                                                onClick={() => setBanningMemberId(null)}
                                            >
                                                {t('common.cancel')}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="home-role-kick"
                                            onClick={() => setBanningMemberId(member.user_id)}
                                        >
                                            {t('server.ban')}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <span className="home-role-pill">{member.role}</span>
                            )}
                        </div>
                    ))}
                </div>
                <div className="home-modal-footer">
                    <button className="home-btn home-btn-secondary" onClick={onClose}>
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
