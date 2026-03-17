'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UsersIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { UserPublic } from '@/lib/types';

const STATUS_DOT: Record<string, string> = {
    online: 'bg-emerald-500',
    dnd: 'bg-red-500',
    offline: 'bg-slate-400',
};

export default function DmSidebar({ friends }: { friends: UserPublic[] }) {
    const pathname = usePathname();
    const { t } = useTranslation();

    return (
        <aside className="flex h-full w-[250px] flex-col gap-3 overflow-hidden border-r border-slate-200 bg-white p-4 box-border">
            <div className="text-[11px] uppercase tracking-[0.08em] text-gray-500">
                {t('dm.title')}
            </div>
            <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {friends.length === 0 && (
                    <p className="px-0 py-1 text-xs text-slate-400">No friends yet.</p>
                )}
                {friends.map((friend) => {
                    const isActive = pathname === `/home/dm/${friend.id}`;
                    const dotClass = STATUS_DOT[friend.status] ?? STATUS_DOT.offline;
                    return (
                        <Link
                            key={friend.id}
                            href={`/home/dm/${friend.id}`}
                            className={clsx(
                                'flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm font-semibold no-underline transition-colors',
                                isActive
                                    ? 'bg-indigo-100 text-indigo-900'
                                    : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700',
                            )}
                        >
                            <span className={clsx('h-2 w-2 shrink-0 rounded-full', dotClass)} />
                            {friend.username}
                        </Link>
                    );
                })}
            </nav>
            <Link
                href="/home"
                className="flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-gray-500 no-underline transition-colors hover:bg-slate-100"
            >
                <UsersIcon className="h-3.5 w-3.5 shrink-0" />
                {t('dm.back_to_friends')}
            </Link>
        </aside>
    );
}
