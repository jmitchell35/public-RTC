// Page serveur (Discord-like) : utilise le layout /home pour la barre de serveurs
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PrimaryButton, SecondaryButton } from "@/components/home/buttons";
import { ChatClient } from "@/components/home/chat_client";

type Server = { id: string; name: string };
type Channel = { id: string; name: string };
type Msg = { id: string; author_id?: string; content: string; created_at: string };

const members = ["Alice", "Bob", "Charlie", "Denise", "Emma", "Hugo", "Zoé"];

async function fetchJson<T>(url: string) {
    const res = await fetch(url, { cache: "no-store", credentials: "include" });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.statusText);
    }
    return res.json() as Promise<T>;
}

export default function ServerPage() {
    const params = useParams<{ id: string }>();
    const serverIdRaw = params?.id;
    const serverId =
        Array.isArray(serverIdRaw) ? serverIdRaw[0] : serverIdRaw ? serverIdRaw : "";
    const [server, setServer] = useState<Server | null>(null);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inviteCode, setInviteCode] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!serverId) {
                setError("Paramètre serveur manquant");
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const serversResp = await fetchJson<{ servers: Server[] }>("/api/servers");
                const s = serversResp.servers.find((x) => x.id === serverId) || null;
                if (!s) throw new Error("Serveur introuvable");
                const channelsResp = await fetchJson<{ channels: Channel[] }>(
                    `/api/servers/${serverId}/channels`
                );
                const chs = channelsResp.channels ?? channelsResp; // support both shapes
                const first = chs[0];
                let msgs: Msg[] = [];
                if (first) {
                    const msgsResp = await fetchJson<{ messages?: Msg[] }>(
                        `/api/channels/${first.id}/messages`
                    );
                    msgs = msgsResp.messages ?? (Array.isArray(msgsResp) ? (msgsResp as any) : []);
                }
                if (!cancelled) {
                    setServer(s);
                    setChannels(chs);
                    setMessages(msgs);
                }
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Erreur");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [params.id]);

    const token = useMemo(() => {
        if (typeof document === "undefined") return "";
        const match = document.cookie
            .split(";")
            .map((c) => c.trim())
            .find((c) => c.startsWith("auth_token="));
        return match ? match.split("=")[1] : "";
    }, []);

    if (loading) {
        return <div style={{ padding: 24 }}>Chargement...</div>;
    }
    if (error) {
        return <div style={{ padding: 24, color: "red" }}>{error}</div>;
    }
    if (!server) {
        return <div style={{ padding: 24 }}>Serveur introuvable</div>;
    }

    const firstChannel = channels[0];
    const channelId = firstChannel?.id ?? "";

    return (
        <>
            {/* Header */}
            <header className="home-header">
                <div className="home-header-left">
                    <div className="home-server-icon-lg">QS</div>
                    <div className="home-header-text">
                        <div className="home-server-name">{server.name}</div>
                        <div className="home-server-status">
                            <span className="home-status-dot" />
                            <span>En ligne</span>
                        </div>
                    </div>
                </div>
                <div className="home-header-actions">
                    <button
                        className="home-btn home-btn-secondary"
                        style={{ padding: "10px 14px" }}
                        onClick={async () => {
                            setInviteCode(null);
                            try {
                                const res = await fetch(`/api/servers/${serverId}/invites`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({}),
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data?.error || "Erreur invite");
                                const code = data?.code;
                                setInviteCode(code ?? null);
                                alert(`Code d'invitation : ${code}`);
                            } catch (e: any) {
                                alert(e.message || "Erreur lors de la création de l'invite");
                            }
                        }}
                    >
                        Invitation
                    </button>
                    <SecondaryButton label="Paramètres" />
                    <PrimaryButton label="Se déconnecter" />
                </div>
            </header>

            {/* Body */}
            <div className="home-body">
                {/* Channel list */}
                <aside className="home-channels">
                    <div className="home-channels-title">Salons</div>
                    <nav className="home-channels-list">
                        {channels.map((c) => (
                            <button key={c.id} className="home-channel-btn">
                                <span className="home-channel-hash">#</span>
                                <span>{c.name}</span>
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Chat + members */}
                <main className="home-content">
                    {/* Chat area (realtime) */}
                    <ChatClient
                        token={token}
                        channelId={channelId}
                        initialMessages={messages.map((m) => ({
                            id: m.id,
                            author: m.author_id ?? "user",
                            content: m.content,
                            created_at: m.created_at,
                        }))}
                    />

                    {/* Members list */}
                    <aside className="home-members">
                        <div className="home-members-title">Membres</div>
                        <div className="home-members-list">
                            {members.map((m) => (
                                <div key={m} className="home-member-item">
                                    <div className="home-member-avatar">{m[0]}</div>
                                    <span className="home-member-name">{m}</span>
                                </div>
                            ))}
                        </div>
                    </aside>
                </main>
            </div>
        </>
    );
}
