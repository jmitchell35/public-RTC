'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
        <aside className="home-channels">
            <div className="home-channels-title">
                {t('server.channels')}
                {canManageChannels ? (
                    <button className="home-channel-add" onClick={onCreate}>
                        +
                    </button>
                ) : null}
            </div>
            <nav className="home-channels-list">
                {channels.map((channel) => (
                    <div key={channel.id} className="home-channel-row">
                        <button
                            className={`home-channel-btn ${channel.id === activeChannelId ? 'is-active' : ''}`}
                            onClick={() => onSelect(channel.id)}
                        >
                            <span className="home-channel-hash">#</span>
                            <span>{channel.name}</span>
                        </button>
                        {canManageChannels ? (
                            <div
                                className="home-channel-menu"
                                onMouseLeave={() =>
                                    setMenuId((prev) => (prev === channel.id ? null : prev))
                                }
                            >
                                <button
                                    className="home-channel-menu-btn"
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
                                    <div className="home-channel-menu-popover">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRename(channel.id);
                                            }}
                                        >
                                            {t('common.rename')}
                                        </button>
                                        <button
                                            type="button"
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
                ))}
            </nav>
        </aside>
    );
}
