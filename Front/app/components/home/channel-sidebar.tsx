'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { Channel } from '@/lib/types';

type Props = {
    channels: Channel[];
    activeChannelId: string;
    canManageChannels: boolean;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onRename: (id: string) => void;
    onDelete: (id: string) => void;
};

export function ChannelSidebar({
    channels,
    activeChannelId,
    canManageChannels,
    onSelect,
    onCreate,
    onRename,
    onDelete,
}: Props) {
    const { t } = useTranslation();
    const [menuId, setMenuId] = useState<string | null>(null);

    return (
        <aside className="flex h-full w-[250px] flex-col gap-3 overflow-hidden border-r border-slate-200 bg-white p-4 box-border">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em] text-gray-500">
                {t('server.channels')}
                {canManageChannels ? (
                    <button
                        className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-slate-50 font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                        onClick={onCreate}
                    >
                        +
                    </button>
                ) : null}
            </div>
            <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {channels.map((channel) => {
                    const isActive = channel.id === activeChannelId;
                    return (
                        <div key={channel.id} className="flex items-center gap-1.5">
                            <button
                                className={clsx(
                                    'flex w-full cursor-pointer items-center gap-2 rounded-[10px] border-0 px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                                    isActive
                                        ? 'bg-indigo-100 text-indigo-900'
                                        : 'bg-transparent text-slate-700 hover:bg-indigo-50 hover:text-indigo-700',
                                )}
                                onClick={() => onSelect(channel.id)}
                            >
                                {isActive && (
                                    <span className="mr-1.5 h-[18px] w-1 shrink-0 rounded-full bg-indigo-600" />
                                )}
                                <span className="text-slate-400">#</span>
                                <span>{channel.name}</span>
                            </button>
                            {canManageChannels ? (
                                <div
                                    className="relative"
                                    onMouseLeave={() =>
                                        setMenuId((prev) => (prev === channel.id ? null : prev))
                                    }
                                >
                                    <button
                                        className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-base text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuId((prev) =>
                                                prev === channel.id ? null : channel.id,
                                            );
                                        }}
                                        title="Actions"
                                    >
                                        ⋮
                                    </button>
                                    {menuId === channel.id ? (
                                        <div className="absolute right-0 top-8 z-20 flex min-w-[140px] flex-col rounded-[10px] border border-slate-200 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
                                            <button
                                                type="button"
                                                className="cursor-pointer border-0 bg-transparent px-3 py-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRename(channel.id);
                                                }}
                                            >
                                                {t('common.rename')}
                                            </button>
                                            <button
                                                type="button"
                                                className="cursor-pointer border-0 bg-transparent px-3 py-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(channel.id);
                                                }}
                                            >
                                                {t('common.delete')}
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
}
