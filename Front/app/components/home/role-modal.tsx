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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40" onClick={onClose}>
            <div
                className="flex w-[min(520px,90vw)] flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_20px_40px_rgba(15,23,42,0.2)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-slate-950">{t('server.roles_title')}</h3>
                        <p className="mt-1 text-[13px] text-slate-500">{t('server.roles_subtitle')}</p>
                    </div>
                    <button
                        className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-slate-50 text-lg text-slate-600"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
                    {members.map((member) => (
                        <div
                            key={member.user_id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 font-bold text-slate-600">
                                    {member.username[0]?.toUpperCase() ?? 'U'}
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-slate-950">{member.username}</div>
                                    <div className="text-xs text-slate-500">{member.role}</div>
                                </div>
                            </div>
                            {isOwner && member.user_id !== meId ? (
                                <div className="flex items-center gap-2">
                                    <select
                                        className="rounded-[10px] border border-slate-200 bg-white px-2.5 py-1.5 text-[13px]"
                                        value={member.role}
                                        onChange={(e) => onRoleUpdate(member.user_id, e.target.value)}
                                    >
                                        <option value="member">member</option>
                                        <option value="admin">admin</option>
                                        <option value="owner">owner</option>
                                    </select>
                                    <button
                                        className="cursor-pointer rounded-[10px] border border-red-200 bg-red-100 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200"
                                        onClick={() => onKick(member.user_id)}
                                    >
                                        {t('server.kick')}
                                    </button>
                                    {banningMemberId === member.user_id ? (
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="rounded-[10px] border border-slate-200 bg-white px-2.5 py-1.5 text-[13px]"
                                                defaultValue=""
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    if (v === '') return;
                                                    setBanningMemberId(null);
                                                    onBan(member.user_id, v === 'permanent' ? null : parseInt(v));
                                                }}
                                            >
                                                <option value="" disabled>{t('server.ban_duration_label')}</option>
                                                <option value="permanent">{t('server.ban_permanent')}</option>
                                                <option value="60">{t('server.ban_1h')}</option>
                                                <option value="1440">{t('server.ban_24h')}</option>
                                                <option value="10080">{t('server.ban_7d')}</option>
                                                <option value="43200">{t('server.ban_30d')}</option>
                                            </select>
                                            <button
                                                className="cursor-pointer rounded-[10px] border border-red-200 bg-red-100 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200"
                                                onClick={() => setBanningMemberId(null)}
                                            >
                                                {t('common.cancel')}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="cursor-pointer rounded-[10px] border border-red-200 bg-red-100 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200"
                                            onClick={() => setBanningMemberId(member.user_id)}
                                        >
                                            {t('server.ban')}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                    {member.role}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex justify-end">
                    <button
                        className="cursor-pointer rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-200"
                        onClick={onClose}
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
