"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SecondaryButton } from "@/components/home/buttons";
import { ChannelSidebar } from "@/components/home/channel-sidebar";
import { ChatClient } from "@/components/home/chat_client";
import { MembersPanel } from "@/components/home/members-panel";
import { RoleModal } from "@/components/home/role-modal";
import { useHomeWs } from "@/components/home/home-ws-provider";
import type {
    Channel,
    ChannelMessage,
    FriendRequestsResponse,
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
    const { t } = useTranslation();
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
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [friends, setFriends] = useState<UserPublic[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequestsResponse>({
        incoming: [],
        outgoing: [],
    });
    const [addingFriendId, setAddingFriendId] = useState<string | null>(null);

    const myRole = useMemo(() => {
        if (!me) return "member";
        return members.find((m) => m.user_id === me.id)?.role ?? "member";
    }, [members, me]);

    const canManageChannels = myRole === "owner" || myRole === "admin";
    const canInvite = myRole === "owner" || myRole === "admin";
    const isOwner = myRole === "owner";

    const friendIds = useMemo(
        () => new Set(friends.map((f) => f.id)),
        [friends],
    );
    const outgoingRequestIds = useMemo(
        () => new Set(friendRequests.outgoing.map((r) => r.user.id)),
        [friendRequests],
    );
    const incomingRequestIds = useMemo(
        () => new Set(friendRequests.incoming.map((r) => r.user.id)),
        [friendRequests],
    );

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!serverId) {
                setError(t("server.missing_server_param"));
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
                        fetchJson<{ channels: Channel[] }>(`/api/servers/${serverId}/channels`),
                        fetchJson<{ members: ServerMember[] }>(`/api/servers/${serverId}/members`),
                    ]);

                const [friendsResp, requestsResp] = await Promise.all([
                    fetchJson<{ friends: UserPublic[] }>("/api/friends").catch((err) => {
                        console.warn("friends load failed", err);
                        return { friends: [] } as { friends?: UserPublic[] };
                    }),
                    fetchJson<FriendRequestsResponse>("/api/friends/requests").catch((err) => {
                        console.warn("friend requests load failed", err);
                        return { incoming: [], outgoing: [] } as FriendRequestsResponse;
                    }),
                ]);

                if (!cancelled) {
                    setMe(meResp.user);
                    setServer(serverResp.server);
                    setChannels(channelsResp.channels);
                    setMembers(membersResp.members);
                    setActiveChannelId(channelsResp.channels[0]?.id ?? "");
                    setFriends(friendsResp.friends ?? []);
                    setFriendRequests(requestsResp);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : t("common.error"));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [serverId, t]);

    const isConnected = ws?.isConnected ?? false;

    useEffect(() => {
        if (!ws || !serverId || !isConnected) return;
        ws.send({ type: "SubscribeServer", data: { server_id: serverId } });
        return () => {
            ws.send({ type: "UnsubscribeServer", data: { server_id: serverId } });
        };
    }, [ws, serverId, isConnected]);

    useEffect(() => {
        if (!ws || !serverId) return;
        return ws.addListener((wsEvent) => {
            if (wsEvent.type === "UserConnected") {
                if (wsEvent.data.server_id !== serverId) return;
                setMembers((prev) => {
                    const exists = prev.find((m) => m.user_id === wsEvent.data.user.id);
                    if (!exists) {
                        refreshMembers().catch(() => {});
                        return prev;
                    }
                    return prev.map((m) =>
                        m.user_id === wsEvent.data.user.id
                            ? { ...m, username: wsEvent.data.user.username, status: wsEvent.data.user.status, online: true }
                            : m,
                    );
                });
            }
            if (wsEvent.type === "UserDisconnected") {
                if (wsEvent.data.server_id !== serverId) return;
                setMembers((prev) =>
                    prev.map((m) =>
                        m.user_id === wsEvent.data.user_id ? { ...m, online: false } : m,
                    ),
                );
            }
            if (wsEvent.type === "ServerMembersUpdated") {
                if (wsEvent.data.server_id !== serverId) return;
                refreshMembers().catch(() => {});
            }
        });
    }, [ws, serverId, refreshMembers]);

    useEffect(() => {
        let cancelled = false;
        async function loadMessages() {
            if (!activeChannelId) {
                setMessages([]);
                setMessagesLoading(false);
                return;
            }
            setMessagesLoading(true);
            try {
                const cacheKey = `channel:${activeChannelId}:messages`;
                const cached = typeof window !== "undefined" ? sessionStorage.getItem(cacheKey) : null;
                if (cached) {
                    const parsed = JSON.parse(cached) as ChannelMessage[];
                    if (!cancelled && Array.isArray(parsed)) setMessages(parsed);
                }
            } catch {
                // ignore cache errors
            }
            try {
                const resp = await fetchJson<{ messages?: ChannelMessage[] }>(
                    `/api/channels/${activeChannelId}/messages?limit=50`,
                );
                const list = Array.isArray(resp.messages) ? resp.messages : [];
                if (!cancelled) {
                    setMessages(list);
                    try {
                        if (typeof window !== "undefined") {
                            sessionStorage.setItem(
                                `channel:${activeChannelId}:messages`,
                                JSON.stringify(list),
                            );
                        }
                    } catch {
                        // ignore cache errors
                    }
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : t("common.error"));
            } finally {
                if (!cancelled) setMessagesLoading(false);
            }
        }
        loadMessages();
        return () => { cancelled = true; };
    }, [activeChannelId, t]);

    const refreshChannels = async () => {
        const resp = await fetchJson<{ channels: Channel[] }>(`/api/servers/${serverId}/channels`);
        setChannels(resp.channels);
        if (!resp.channels.find((ch) => ch.id === activeChannelId)) {
            setActiveChannelId(resp.channels[0]?.id ?? "");
        }
    };

    const refreshMembers = useCallback(async () => {
        try {
            const resp = await fetchJson<{ members: ServerMember[] }>(`/api/servers/${serverId}/members`);
            setMembers(resp.members);
        } catch (err) {
            console.warn("refreshMembers failed", err);
        }
    }, [serverId]);

    // ── Channel actions ──────────────────────────────────────────────────────

    const handleCreateChannel = async () => {
        const name = prompt(t("server.channel_name_prompt"));
        if (!name?.trim()) return;
        const res = await fetch(`/api/servers/${serverId}/channels`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
        });
        if (res.ok) {
            await refreshChannels();
        } else {
            const text = await res.text();
            alert(t("server.channel_create_failed", { status: res.status, text }));
        }
    };

    const handleDeleteChannel = async (channelId: string) => {
        if (!confirm(t("common.delete") + " ?")) return;
        const res = await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
        if (res.ok) {
            await refreshChannels();
        } else {
            const text = await res.text();
            alert(t("server.channel_delete_failed", { status: res.status, text }));
        }
    };

    const handleRenameChannel = async (channelId: string) => {
        const name = prompt(t("server.channel_rename_prompt"));
        if (!name?.trim()) return;
        const res = await fetch(`/api/channels/${channelId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
        });
        if (res.ok) {
            await refreshChannels();
        } else {
            const text = await res.text();
            alert(t("server.channel_rename_failed", { status: res.status, text }));
        }
    };

    // ── Server actions ───────────────────────────────────────────────────────

    const handleLeaveServer = async () => {
        if (!confirm(t("server.leave_confirm"))) return;
        const res = await fetch(`/api/servers/${serverId}/leave`, { method: "DELETE" });
        if (res.ok || res.status === 502) {
            window.dispatchEvent(new CustomEvent("servers-remove", { detail: { id: serverId } }));
            window.dispatchEvent(new Event("servers-refresh"));
            router.push("/home");
        } else {
            const text = await res.text();
            alert(t("server.leave_failed", { status: res.status, text }));
            window.dispatchEvent(new Event("servers-refresh"));
        }
    };

    const handleDeleteServer = async () => {
        if (!confirm(t("server.delete_confirm"))) return;
        const res = await fetch(`/api/servers/${serverId}`, { method: "DELETE" });
        if (res.ok || res.status === 502) {
            window.dispatchEvent(new CustomEvent("servers-remove", { detail: { id: serverId } }));
            window.dispatchEvent(new Event("servers-refresh"));
            router.push("/home");
        } else {
            const text = await res.text();
            alert(t("server.delete_server_failed", { status: res.status, text }));
            window.dispatchEvent(new Event("servers-refresh"));
        }
    };

    const handleInvite = async () => {
        try {
            const res = await fetch(`/api/servers/${serverId}/invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || t("server.invite_create_failed"));
            alert(t("server.invite_code_display", { code: data?.code }));
        } catch (err) {
            alert(err instanceof Error ? err.message : t("server.invite_create_failed"));
        }
    };

    // ── Member actions ───────────────────────────────────────────────────────

    const handleRoleUpdate = async (userId: string, role: string) => {
        try {
            const res = await fetch(`/api/servers/${serverId}/members/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            });
            if (res.ok || res.status === 502) {
                await refreshMembers();
                return;
            }
            const text = await res.text();
            alert(t("server.role_change_failed", { status: res.status, text }));
        } catch {
            alert(t("common.backend_unreachable"));
        }
    };

    const handleKickMember = async (userId: string) => {
        if (!window.confirm(t("server.kick_confirm"))) return;
        try {
            const res = await fetch(`/api/servers/${serverId}/members/${userId}`, { method: "DELETE" });
            if (res.ok || res.status === 502) {
                await refreshMembers();
                return;
            }
            const text = await res.text();
            alert(t("server.kick_failed", { status: res.status, text }));
        } catch {
            alert(t("common.backend_unreachable"));
        }
    };

    const handleBanMember = async (userId: string, durationMinutes: number | null) => {
        try {
            const body: { duration_minutes?: number } = {};
            if (durationMinutes !== null) body.duration_minutes = durationMinutes;
            const res = await fetch(`/api/servers/${serverId}/members/${userId}/ban`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (res.ok || res.status === 502) {
                await refreshMembers();
                return;
            }
            const text = await res.text();
            alert(t("server.ban_failed", { status: res.status, text }));
        } catch {
            alert(t("common.backend_unreachable"));
        }
    };

    const handleAddFriend = async (member: ServerMember) => {
        if (!member.friend_code || addingFriendId) return;
        setAddingFriendId(member.user_id);
        try {
            const res = await fetch("/api/friends/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ friend_code: member.friend_code }),
            });
            if (!res.ok) {
                const text = await res.text();
                alert(`${res.status} ${text}`);
                return;
            }
            const data = await res.json().catch(() => null);
            if (data?.request) {
                setFriendRequests((prev) => ({
                    ...prev,
                    outgoing: [...prev.outgoing, data.request],
                }));
            }
        } catch {
            alert(t("common.backend_unreachable"));
        } finally {
            setAddingFriendId(null);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────

    if (loading) return <div style={{ padding: 24 }}>{t("common.loading")}</div>;
    if (error) return <div style={{ padding: 24, color: "red" }}>{error}</div>;
    if (!server) return <div style={{ padding: 24 }}>{t("server.server_not_found")}</div>;

    const activeChannel = channels.find((ch) => ch.id === activeChannelId);

    return (
        <>
            <header className="flex h-16 items-center justify-between bg-white px-6 shadow-[0_6px_16px_rgba(15,23,42,0.08)]">
                <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-500 font-bold text-white">
                        {server.name?.[0]?.toUpperCase() ?? "S"}
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="text-[17px] font-semibold">{server.name}</div>
                        <div className="flex items-center gap-1.5 text-[13px] text-emerald-600">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span>
                                {t("server.online_count", {
                                    count: members.filter((m) => m.online).length,
                                })}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2.5">
                    {isOwner ? (
                        <SecondaryButton
                            label={t("server.roles_btn")}
                            onClick={() => setShowRoleModal(true)}
                        />
                    ) : null}
                    {canInvite ? (
                        <button
                            className="cursor-pointer rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-bold text-slate-950 hover:bg-slate-200"
                            onClick={handleInvite}
                        >
                            {t("server.invite_btn")}
                        </button>
                    ) : null}
                    {isOwner ? (
                        <SecondaryButton label={t("server.delete_btn")} onClick={handleDeleteServer} />
                    ) : (
                        <SecondaryButton label={t("server.leave_btn")} onClick={handleLeaveServer} />
                    )}
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <ChannelSidebar
                    channels={channels}
                    activeChannelId={activeChannelId}
                    canManageChannels={canManageChannels}
                    onSelect={setActiveChannelId}
                    onCreate={handleCreateChannel}
                    onRename={handleRenameChannel}
                    onDelete={handleDeleteChannel}
                />

                <main className="grid min-w-0 flex-1 grid-cols-[2fr_1fr]">
                    <ChatClient
                        key={activeChannelId}
                        channelId={activeChannelId}
                        channelName={activeChannel?.name ?? ""}
                        initialMessages={messages}
                        members={members}
                        currentUserId={me?.id ?? ""}
                        isLoading={messagesLoading}
                    />

                    <MembersPanel
                        members={members}
                        meId={me?.id ?? ""}
                        friendIds={friendIds}
                        outgoingRequestIds={outgoingRequestIds}
                        incomingRequestIds={incomingRequestIds}
                        addingFriendId={addingFriendId}
                        onAddFriend={handleAddFriend}
                    />
                </main>
            </div>

            {showRoleModal ? (
                <RoleModal
                    members={members}
                    meId={me?.id ?? ""}
                    isOwner={isOwner}
                    onClose={() => setShowRoleModal(false)}
                    onRoleUpdate={handleRoleUpdate}
                    onKick={handleKickMember}
                    onBan={handleBanMember}
                />
            ) : null}
        </>
    );
}
