'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UsersIcon } from '@heroicons/react/24/solid';
import type { UserPublic } from '@/lib/types';

const STATUS_DOT: Record<string, string> = {
    online: '#10b981',
    dnd: '#ef4444',
    offline: '#94a3b8',
};

export default function DmSidebar({ friends }: { friends: UserPublic[] }) {
    const pathname = usePathname();

    return (
        <aside className="home-channels">
            <div className="home-channels-title">
                Direct Messages
            </div>
            <nav className="home-channels-list" style={{ flex: 1, overflowY: 'auto' }}>
                {friends.length === 0 && (
                    <p style={{ fontSize: 12, color: '#94a3b8', padding: '4px 0' }}>
                        No friends yet.
                    </p>
                )}
                {friends.map((friend) => {
                    const isActive = pathname === `/home/dm/${friend.id}`;
                    const dotColor = STATUS_DOT[friend.status] ?? STATUS_DOT.offline;
                    return (
                        <Link
                            key={friend.id}
                            href={`/home/dm/${friend.id}`}
                            className={`home-channel-btn${isActive ? ' is-active' : ''}`}
                            style={{ textDecoration: 'none' }}
                        >
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: dotColor,
                                    flexShrink: 0,
                                }}
                            />
                            {friend.username}
                        </Link>
                    );
                })}
            </nav>
            <Link
                href="/home"
                className="home-channel-btn"
                style={{ textDecoration: 'none', color: '#6b7280', marginTop: 4 }}
            >
                <UsersIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                Friends
            </Link>
        </aside>
    );
}
