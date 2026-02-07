'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSelectedLayoutSegment } from 'next/navigation';
import { ServerBar } from '@/components/home/server_bar';
import { useHomeWs } from '@/components/home/home-ws-provider';

type Server = { id: string; name: string; icon: string; notif?: number };

export default function HomeShell({ children }: { children: ReactNode }) {
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
                const list = Array.isArray(data?.servers)
                    ? data.servers
                    : data ?? [];
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

    useEffect(() => {
        fetchServers();
    }, [fetchServers, pathname]);

    useEffect(() => {
        const handler = () => {
            fetchServers();
        };
        window.addEventListener('servers-refresh', handler);
        return () => {
            window.removeEventListener('servers-refresh', handler);
        };
    }, [fetchServers]);

    useEffect(() => {
        if (!ws || !isConnected) {
            return;
        }
        servers.forEach((server) => {
            ws.send({
                type: 'SubscribeServer',
                data: { server_id: server.id },
            });
        });
    }, [ws, isConnected, servers]);

    useEffect(() => {
        if (!ws) {
            return;
        }
        return ws.addListener((wsEvent) => {
            if (wsEvent.type === 'Notification') {
                setServers((prev) =>
                    prev.map((server) =>
                        server.id === wsEvent.data.server_id
                            ? {
                                  ...server,
                                  notif: (server.notif ?? 0) + 1,
                              }
                            : server,
                    ),
                );
            }
        });
    }, [ws]);

    const createServer = async () => {
        if (!newServerName.trim()) {
            return;
        }
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
                ws?.send({
                    type: 'SubscribeServer',
                    data: { server_id: data.server.id },
                });
            }
        } else {
            const text = await res.text();
            console.error('create server error', res.status, text);
            alert(`Création échouée (${res.status}) ${text}`);
        }
    };

    const joinServer = async () => {
        if (!inviteCode.trim()) {
            return;
        }
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
                    const list = Array.isArray(data?.servers)
                        ? data.servers
                        : data ?? [];
                    list.forEach((server: { id: string }) => {
                        ws?.send({
                            type: 'SubscribeServer',
                            data: { server_id: server.id },
                        });
                    });
                    const newest = list[0];
                    if (newest?.id) {
                        router.push(`/home/${newest.id}`);
                    }
                }
            } catch {
                // ignore
            }
        } else {
            const text = await res.text();
            console.error('join server error', res.status, text);
            alert(`Rejoindre échoué (${res.status}) ${text}`);
        }
    };

    const content = useMemo(() => {
        if (!loading) {
            return children;
        }
        return <div style={{ padding: 16 }}>Chargement...</div>;
    }, [children, loading]);

    return (
        <div className="home-root">
            <ServerBar
                servers={servers}
                activeId={activeId}
                onSelect={(id) => {
                    setServers((prev) =>
                        prev.map((server) =>
                            server.id === id ? { ...server, notif: 0 } : server,
                        ),
                    );
                    router.push(`/home/${id}`);
                }}
                onAdd={() => setShowDialog(true)}
            />
            <div className="home-main">{content}</div>

            {showDialog ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50,
                    }}
                    onClick={() => setShowDialog(false)}
                >
                    <div
                        style={{
                            background: 'white',
                            padding: '20px',
                            borderRadius: '12px',
                            width: '360px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
                            Serveur
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div>
                                <label style={{ fontSize: 12, color: '#475569' }}>
                                    Nom du serveur
                                </label>
                                <input
                                    value={newServerName}
                                    onChange={(event) =>
                                        setNewServerName(event.target.value)
                                    }
                                    placeholder="Ex: Mon serveur"
                                    style={{
                                        width: '100%',
                                        marginTop: 4,
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        border: '1px solid #e2e8f0',
                                    }}
                                />
                                <button
                                    onClick={createServer}
                                    style={{
                                        marginTop: 8,
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: 10,
                                        border: 'none',
                                        background: 'linear-gradient(135deg,#4f46e5,#6366f1)',
                                        color: 'white',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Créer
                                </button>
                            </div>
                            <div
                                style={{
                                    height: 1,
                                    background: '#e2e8f0',
                                    margin: '4px 0',
                                }}
                            />
                            <div>
                                <label style={{ fontSize: 12, color: '#475569' }}>
                                    Code d'invitation
                                </label>
                                <input
                                    value={inviteCode}
                                    onChange={(event) =>
                                        setInviteCode(event.target.value)
                                    }
                                    placeholder="Code"
                                    style={{
                                        width: '100%',
                                        marginTop: 4,
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        border: '1px solid #e2e8f0',
                                    }}
                                />
                                <button
                                    onClick={joinServer}
                                    style={{
                                        marginTop: 8,
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: 10,
                                        border: 'none',
                                        background: '#0ea5e9',
                                        color: 'white',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Rejoindre
                                </button>
                            </div>
                            <button
                                onClick={() => setShowDialog(false)}
                                style={{
                                    marginTop: 6,
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: 10,
                                    border: '1px solid #e2e8f0',
                                    background: '#f8fafc',
                                    cursor: 'pointer',
                                }}
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
