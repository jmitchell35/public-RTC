'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import type { DirectMessagesResponse, UserPublic } from '@/lib/types';
import DirectMessageThread from '@/components/home/direct-message-thread';

type DirectMessageClientProps = {
    friendId: string;
};

type LoadedState = {
    me: UserPublic;
    friend: UserPublic;
    messages: DirectMessagesResponse['messages'];
};

export default function DirectMessageClient({
    friendId,
}: DirectMessageClientProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const [state, setState] = useState<LoadedState | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const load = async () => {
            setState(null);
            setError(null);
            try {
                const [meResponse, dmResponse] = await Promise.all([
                    fetch('/api/me', { method: 'GET' }),
                    fetch(`/api/dm/${friendId}?limit=50`, {
                        method: 'GET',
                    }),
                ]);

                if (!active) {
                    return;
                }

                if (meResponse.status === 401 || dmResponse.status === 401) {
                    router.replace('/login');
                    return;
                }
                if (
                    dmResponse.status === 403 ||
                    dmResponse.status === 404
                ) {
                    router.replace('/home');
                    return;
                }

                if (!meResponse.ok || !dmResponse.ok) {
                    setError(t('dm.unable_to_load'));
                    return;
                }

                const meData = (await meResponse.json()) as { user: UserPublic };
                const dmData =
                    (await dmResponse.json()) as DirectMessagesResponse;
                if (!active) {
                    return;
                }
                setState({
                    me: meData.user,
                    friend: dmData.friend,
                    messages: dmData.messages,
                });
            } catch (err) {
                if (active) {
                    setError(t('common.backend_unreachable'));
                }
            }
        };

        load();

        return () => {
            active = false;
        };
    }, [friendId, router]);

    if (error) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-[#eef2f7] text-slate-900">
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/80 px-6 py-8 text-center shadow-sm">
                    <h1 className="text-lg font-semibold text-slate-800">
                        {error}
                    </h1>
                    <p className="text-sm text-slate-500">
                        {t('dm.try_again_hint')}
                    </p>
                    <Link
                        href="/home"
                        className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
                    >
                        {t('dm.back_btn')}
                    </Link>
                </div>
            </main>
        );
    }

    if (!state) {
        return (
            <main className="flex min-h-screen flex-col bg-[#eef2f7] text-slate-900">
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-200" />
                        <div className="space-y-2">
                            <div className="h-3 w-32 rounded-full bg-slate-200" />
                            <div className="h-2 w-20 rounded-full bg-slate-100" />
                        </div>
                    </div>
                    <div className="h-3 w-24 rounded-full bg-slate-100" />
                </header>
                <section className="flex flex-1 flex-col gap-4 px-6 py-6">
                    <div className="flex-1 space-y-3">
                        <div className="h-20 rounded-2xl bg-white/70 shadow-sm" />
                        <div className="h-20 rounded-2xl bg-white/70 shadow-sm" />
                        <div className="h-20 rounded-2xl bg-white/70 shadow-sm" />
                    </div>
                    <div className="h-16 rounded-2xl bg-white shadow-sm" />
                </section>
            </main>
        );
    }

    return (
        <DirectMessageThread
            me={state.me}
            friend={state.friend}
            initialMessages={state.messages}
        />
    );
}
