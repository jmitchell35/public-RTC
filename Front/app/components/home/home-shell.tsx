'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSelectedLayoutSegment } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ServerBar } from '@/components/home/server_bar';
import { useHomeWs } from '@/components/home/home-ws-provider';

type Server = { id: string; name: string; icon: string; notif?: number };

export default function HomeShell({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const router = useRouter();
    const segment = useSelectedLayoutSegment();
    const activeId = segment && segment !== 'dm' ? segment : undefined;
    const pathname = usePathname();
    const ws = useHomeWs();
    const isConnected = ws?.isConnected ?? false;

    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [newServerName, setNewServerName] = useState('');
    const [inviteCode, setInviteCode] = useState('');

    const fetchServers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/servers', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data?.servers) ? data.servers : data ?? [];
                setServers(
                    list.map((server: { id: string; name: string }) => ({
                        id: server.id,
                        name: server.name,
                        icon: server.name?.[0]?.toUpperCase() ?? '?',
                        notif: 0,
                    })),
                );
                return list as Array<{ id: string; name: string }>;
            } else {
                console.warn('GET /api/servers failed', res.status);
            }
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchServers(); }, [fetchServers, pathname]);

    useEffect(() => {
        const handler = () => { fetchServers(); };
        window.addEventListener('servers-refresh', handler);
        return () => { window.removeEventListener('servers-refresh', handler); };
    }, [fetchServers]);

    useEffect(() => {
        const handler = (event: Event) => {
            const custom = event as CustomEvent<{ id?: string }>;
            if (!custom.detail?.id) return;
            setServers((prev) => prev.filter((s) => s.id !== custom.detail?.id));
        };
        window.addEventListener('servers-remove', handler as EventListener);
        return () => { window.removeEventListener('servers-remove', handler as EventListener); };
    }, []);

    useEffect(() => {
        if (!ws || !isConnected) return;
        servers.forEach((s) => ws.send({ type: 'SubscribeServer', data: { server_id: s.id } }));
    }, [ws, isConnected, servers]);

    useEffect(() => {
        if (!ws) return;
        return ws.addListener((wsEvent) => {
            if (wsEvent.type === 'Notification') {
                setServers((prev) =>
                    prev.map((s) =>
                        s.id === wsEvent.data.server_id ? { ...s, notif: (s.notif ?? 0) + 1 } : s,
                    ),
                );
            }
        });
    }, [ws]);

    const createServer = async () => {
        if (!newServerName.trim()) return;
        const res = await fetch('/api/servers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newServerName.trim() }),
        });
        if (res.ok) {
            const data = await res.json().catch(() => null);
            setNewServerName('');
            setShowDialog(false);
            await fetchServers();
            if (data?.server?.id) {
                ws?.send({ type: 'SubscribeServer', data: { server_id: data.server.id } });
            }
        } else {
            const text = await res.text();
            alert(t('shell.create_failed', { status: res.status, text }));
        }
    };

    const joinServer = async () => {
        if (!inviteCode.trim()) return;
        const res = await fetch(`/api/invites/${inviteCode.trim()}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
            setInviteCode('');
            setShowDialog(false);
            await fetchServers();
            try {
                const res2 = await fetch('/api/servers', { cache: 'no-store' });
                if (res2.ok) {
                    const data = await res2.json();
                    const list = Array.isArray(data?.servers) ? data.servers : data ?? [];
                    list.forEach((s: { id: string }) => {
                        ws?.send({ type: 'SubscribeServer', data: { server_id: s.id } });
                    });
                    const newest = list[0];
                    if (newest?.id) router.push(`/home/${newest.id}`);
                }
            } catch { /* ignore */ }
        } else {
            const text = await res.text();
            alert(t('shell.join_failed', { status: res.status, text }));
        }
    };

    const content = useMemo(() => {
        if (!loading) return children;
        return <div className="p-4">{t('common.loading')}</div>;
    }, [children, loading, t]);

    return (
        <div className="flex h-screen overflow-hidden bg-[#eef2f7] text-slate-950">
            <ServerBar
                servers={servers}
                activeId={activeId}
                onSelect={(id) => {
                    setServers((prev) => prev.map((s) => s.id === id ? { ...s, notif: 0 } : s));
                    router.push(`/home/${id}`);
                }}
                onAdd={() => setShowDialog(true)}
            />
            <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">{content}</div>

            {showDialog ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/35"
                    onClick={() => setShowDialog(false)}
                >
                    <div
                        className="w-[360px] rounded-xl bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="mb-3 text-lg font-bold">{t('shell.server_dialog_title')}</h3>
                        <div className="flex flex-col gap-2.5">
                            <div>
                                <label className="text-xs text-slate-600">{t('shell.server_name_label')}</label>
                                <input
                                    value={newServerName}
                                    onChange={(e) => setNewServerName(e.target.value)}
                                    placeholder={t('shell.server_name_placeholder')}
                                    className="mt-1 w-full rounded-[10px] border border-slate-200 px-3 py-2.5"
                                />
                                <button
                                    onClick={createServer}
                                    className="mt-2 w-full cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-indigo-600 to-indigo-500 py-2.5 font-bold text-white"
                                >
                                    {t('common.create')}
                                </button>
                            </div>
                            <div className="my-1 h-px bg-slate-200" />
                            <div>
                                <label className="text-xs text-slate-600">{t('shell.invite_code_label')}</label>
                                <input
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value)}
                                    placeholder={t('shell.invite_code_placeholder')}
                                    className="mt-1 w-full rounded-[10px] border border-slate-200 px-3 py-2.5"
                                />
                                <button
                                    onClick={joinServer}
                                    className="mt-2 w-full cursor-pointer rounded-[10px] border-0 bg-sky-500 py-2.5 font-bold text-white"
                                >
                                    {t('common.join')}
                                </button>
                            </div>
                            <button
                                onClick={() => setShowDialog(false)}
                                className="mt-1.5 w-full cursor-pointer rounded-[10px] border border-slate-200 bg-slate-50 py-2"
                            >
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
