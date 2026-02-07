"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SecondaryButton } from "@/components/home/buttons";
import { ChatClient } from "@/components/home/chat_client";
import { useHomeWs } from "@/components/home/home-ws-provider";
import type {
    Channel,
    ChannelMessage,
    Server,
    ServerMember,
    UserPublic,
} from "@/lib/types";

type MeResponse = { user: UserPublic };

async function fetchJson<T>(url: string) {
    const res = await fetch(url, { cache: "no-store", credentials: "include" });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || res.statusText);
    }
    return res.json() as Promise<T>;
}

export default function ServerPage() {
    const router = useRouter();
    const ws = useHomeWs();
    const params = useParams<{ id: string }>();
    const serverIdRaw = params?.id;
    const serverId =
        Array.isArray(serverIdRaw) ? serverIdRaw[0] : serverIdRaw ? serverIdRaw : "";
    const [server, setServer] = useState<Server | null>(null);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [members, setMembers] = useState<ServerMember[]>([]);
    const [messages, setMessages] = useState<ChannelMessage[]>([]);
    const [activeChannelId, setActiveChannelId] = useState<string>("");
    const [me, setMe] = useState<MeResponse["user"] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [channelMenuId, setChannelMenuId] = useState<string | null>(null);
    const [showRoleModal, setShowRoleModal] = useState(false);

    const myRole = useMemo(() => {
        if (!me) {
            return "member";
        }
        return (
            members.find((member) => member.user_id === me.id)?.role ?? "member"
        );
    }, [members, me]);

    const canManageChannels = myRole === "owner" || myRole === "admin";
    const canInvite = myRole === "owner" || myRole === "admin";
    const isOwner = myRole === "owner";

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
                    const [meResp, serverResp, channelsResp, membersResp] =
                    await Promise.all([
                        fetchJson<MeResponse>("/api/me"),
                        fetchJson<{ server: Server }>(`/api/servers/${serverId}`),
                        fetchJson<{ channels: Channel[] }>(
                            `/api/servers/${serverId}/channels`
                        ),
                        fetchJson<{ members: Member[] }>(
                            `/api/servers/${serverId}/members`
                        ),
                    ]);

                const serverData = (serverResp as any)?.server ?? serverResp;
                const channelList =
                    (channelsResp as any)?.channels ?? (channelsResp as any);
                const memberList =
                    (membersResp as any)?.members ?? (membersResp as any);

                if (!cancelled) {
                    setMe(meResp.user);
                    setServer(serverData);
                    setChannels(channelList);
                    setMembers(memberList);
                    setActiveChannelId(channelList[0]?.id ?? "");
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err.message || "Erreur");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [serverId]);

    const isConnected = ws?.isConnected ?? false;

    useEffect(() => {
        if (!ws || !serverId || !isConnected) {
            return;
        }
        ws.send({ type: "SubscribeServer", data: { server_id: serverId } });
        return () => {
            ws.send({ type: "UnsubscribeServer", data: { server_id: serverId } });
        };
    }, [ws, serverId, isConnected]);

    useEffect(() => {
        if (!ws || !serverId) {
            return;
        }
        return ws.addListener((wsEvent) => {
            if (wsEvent.type === "UserConnected") {
                if (wsEvent.data.server_id !== serverId) {
                    return;
                }
                setMembers((prev) => {
                    const exists = prev.find(
                        (member) => member.user_id === wsEvent.data.user.id,
                    );
                    if (!exists) {
                        refreshMembers().catch(() => {});
                        return prev;
                    }
                    return prev.map((member) =>
                        member.user_id === wsEvent.data.user.id
                            ? {
                                  ...member,
                                  username: wsEvent.data.user.username,
                                  online: true,
                              }
                            : member,
                    );
                });
            }
            if (wsEvent.type === "UserDisconnected") {
                if (wsEvent.data.server_id !== serverId) {
                    return;
                }
                setMembers((prev) =>
                    prev.map((member) =>
                        member.user_id === wsEvent.data.user_id
                            ? { ...member, online: false }
                            : member,
                    ),
                );
            }
        });
    }, [ws, serverId]);

    useEffect(() => {
        let cancelled = false;
        async function loadMessages() {
            if (!activeChannelId) {
                setMessages([]);
                return;
            }
            try {
                const resp = await fetchJson<{ messages?: ChannelMessage[] }>(
                    `/api/channels/${activeChannelId}/messages?limit=50`
                );
                const list = (resp as any)?.messages ?? (resp as any);
                if (!cancelled) {
                    setMessages(Array.isArray(list) ? list : []);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err.message || "Erreur");
                }
            }
        }
        loadMessages();
        return () => {
            cancelled = true;
        };
    }, [activeChannelId]);

    const refreshChannels = async () => {
        const resp = await fetchJson<{ channels: Channel[] }>(
            `/api/servers/${serverId}/channels`
        );
        const channelList = (resp as any)?.channels ?? (resp as any);
        setChannels(channelList);
        if (!channelList.find((channel: Channel) => channel.id === activeChannelId)) {
            setActiveChannelId(channelList[0]?.id ?? "");
        }
    };

    const refreshMembers = async () => {
        const resp = await fetchJson<{ members: ServerMember[] }>(
            `/api/servers/${serverId}/members`
        );
        const memberList = (resp as any)?.members ?? (resp as any);
        setMembers(memberList);
    };

    if (loading) {
        return <div style={{ padding: 24 }}>Chargement...</div>;
    }
    if (error) {
        return <div style={{ padding: 24, color: "red" }}>{error}</div>;
    }
    if (!server) {
        return <div style={{ padding: 24 }}>Serveur introuvable</div>;
    }

    const activeChannel = channels.find(
        (channel) => channel.id === activeChannelId,
    );

    const handleCreateChannel = async () => {
        const name = prompt("Nom du salon");
        if (!name || !name.trim()) {
            return;
        }
        const res = await fetch(`/api/servers/${serverId}/channels`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
        });
        if (res.ok) {
            await refreshChannels();
        } else {
            const text = await res.text();
            alert(`Création échouée (${res.status}) ${text}`);
        }
    };

    const handleDeleteChannel = async (channelId: string) => {
        if (!confirm("Supprimer ce salon ?")) {
            return;
        }
        setChannelMenuId(null);
        const res = await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
        if (res.ok) {
            await refreshChannels();
        } else {
            const text = await res.text();
            alert(`Suppression échouée (${res.status}) ${text}`);
        }
    };

    const handleRenameChannel = async (channelId: string) => {
        const name = prompt("Nouveau nom du salon");
        if (!name || !name.trim()) {
            return;
        }
        setChannelMenuId(null);
        const res = await fetch(`/api/channels/${channelId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
        });
        if (res.ok) {
            await refreshChannels();
        } else {
            const text = await res.text();
            alert(`Modification échouée (${res.status}) ${text}`);
        }
    };

    const handleLeaveServer = async () => {
        if (!confirm("Quitter ce serveur ?")) {
            return;
        }
        const res = await fetch(`/api/servers/${serverId}/leave`, {
            method: "DELETE",
        });
        if (res.ok) {
            router.push("/home");
        } else {
            const text = await res.text();
            alert(`Quitter échoué (${res.status}) ${text}`);
        }
    };

    const handleDeleteServer = async () => {
        if (!confirm("Supprimer ce serveur ?")) {
            return;
        }
        const res = await fetch(`/api/servers/${serverId}`, { method: "DELETE" });
        if (res.ok) {
            router.push("/home");
        } else {
            const text = await res.text();
            alert(`Suppression échouée (${res.status}) ${text}`);
        }
    };

    const handleInvite = async () => {
        setInviteCode(null);
        try {
            const res = await fetch(`/api/servers/${serverId}/invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Erreur invite");
            }
            const code = data?.code;
            setInviteCode(code ?? null);
            alert(`Code d'invitation : ${code}`);
        } catch (err: any) {
            alert(err.message || "Erreur lors de la création de l'invite");
        }
    };

    const handleRoleUpdate = async (userId: string, role: string) => {
        const res = await fetch(`/api/servers/${serverId}/members/${userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role }),
        });
        if (res.ok) {
            await refreshMembers();
        } else {
            const text = await res.text();
            alert(`Changement échoué (${res.status}) ${text}`);
        }
    };

    return (
        <>
            <header className="home-header">
                <div className="home-header-left">
                    <div className="home-server-icon-lg">
                        {server.name?.[0]?.toUpperCase() ?? "S"}
                    </div>
                    <div className="home-header-text">
                        <div className="home-server-name">{server.name}</div>
                        <div className="home-server-status">
                            <span className="home-status-dot" />
                            <span>{members.filter((m) => m.online).length} en ligne</span>
                        </div>
                    </div>
                </div>
                <div className="home-header-actions">
                    {isOwner ? (
                        <SecondaryButton
                            label="Roles"
                            onClick={() => setShowRoleModal(true)}
                        />
                    ) : null}
                    {canInvite ? (
                        <button
                            className="home-btn home-btn-secondary"
                            style={{ padding: "10px 14px" }}
                            onClick={handleInvite}
                        >
                            Invitation
                        </button>
                    ) : null}
                    {isOwner ? (
                        <SecondaryButton label="Supprimer" onClick={handleDeleteServer} />
                    ) : (
                        <SecondaryButton label="Quitter" onClick={handleLeaveServer} />
                    )}
                </div>
            </header>

            <div className="home-body">
                <aside className="home-channels">
                    <div className="home-channels-title">
                        Salons
                        {canManageChannels ? (
                            <button
                                className="home-channel-add"
                                onClick={handleCreateChannel}
                            >
                                +
                            </button>
                        ) : null}
                    </div>
                    <nav className="home-channels-list">
                        {channels.map((channel) => (
                            <div key={channel.id} className="home-channel-row">
                                <button
                                    className={`home-channel-btn ${
                                        channel.id === activeChannelId ? "is-active" : ""
                                    }`}
                                    onClick={() => setActiveChannelId(channel.id)}
                                >
                                    <span className="home-channel-hash">#</span>
                                    <span>{channel.name}</span>
                                </button>
                                {canManageChannels ? (
                                    <div
                                        className="home-channel-menu"
                                        onMouseLeave={() =>
                                            setChannelMenuId((prev) =>
                                                prev === channel.id ? null : prev,
                                            )
                                        }
                                    >
                                        <button
                                            className="home-channel-menu-btn"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setChannelMenuId((prev) =>
                                                    prev === channel.id
                                                        ? null
                                                        : channel.id,
                                                );
                                            }}
                                            title="Actions"
                                        >
                                            ⋮
                                        </button>
                                        {channelMenuId === channel.id ? (
                                            <div className="home-channel-menu-popover">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleRenameChannel(
                                                            channel.id,
                                                        );
                                                    }}
                                                >
                                                    Renommer
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDeleteChannel(
                                                            channel.id,
                                                        );
                                                    }}
                                                >
                                                    Supprimer
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </nav>
                </aside>

                <main className="home-content">
                    <ChatClient
                        key={activeChannelId}
                        channelId={activeChannelId}
                        channelName={activeChannel?.name ?? ""}
                        initialMessages={messages}
                        members={members}
                        currentUserId={me?.id ?? ""}
                    />

                    <aside className="home-members">
                        <div className="home-members-title">
                            Membres
                            <span className="home-members-count">
                                {members.length}
                            </span>
                        </div>
                        <div className="home-members-list">
                            {members.map((member) => (
                                <div key={member.user_id} className="home-member-item">
                                    <div className="home-member-avatar">
                                        {member.username[0]?.toUpperCase() ?? "U"}
                                    </div>
                                    <div className="home-member-meta">
                                        <span className="home-member-name">
                                            {member.username}
                                        </span>
                                        <span className="home-member-role">
                                            {member.role}
                                            {member.online ? " • online" : " • offline"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>
                </main>
            </div>

            {showRoleModal ? (
                <div
                    className="home-modal-backdrop"
                    onClick={() => setShowRoleModal(false)}
                >
                    <div
                        className="home-modal-card"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="home-modal-header">
                            <div>
                                <h3 className="home-modal-title">Roles du serveur</h3>
                                <p className="home-modal-subtitle">
                                    Définissez les permissions des membres.
                                </p>
                            </div>
                            <button
                                className="home-modal-close"
                                onClick={() => setShowRoleModal(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="home-modal-body">
                            {members.map((member) => (
                                <div
                                    key={member.user_id}
                                    className="home-role-row"
                                >
                                    <div className="home-role-user">
                                        <div className="home-member-avatar">
                                            {member.username[0]?.toUpperCase() ?? "U"}
                                        </div>
                                        <div>
                                            <div className="home-member-name">
                                                {member.username}
                                            </div>
                                            <div className="home-member-role">
                                                {member.role}
                                            </div>
                                        </div>
                                    </div>
                                    {isOwner && member.user_id !== me?.id ? (
                                        <select
                                            className="home-role-select"
                                            value={member.role}
                                            onChange={(event) =>
                                                handleRoleUpdate(
                                                    member.user_id,
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            <option value="member">member</option>
                                            <option value="admin">admin</option>
                                            <option value="owner">owner</option>
                                        </select>
                                    ) : (
                                        <span className="home-role-pill">
                                            {member.role}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="home-modal-footer">
                            <button
                                className="home-btn home-btn-secondary"
                                onClick={() => setShowRoleModal(false)}
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
