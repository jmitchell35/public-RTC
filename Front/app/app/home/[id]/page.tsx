"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SecondaryButton } from "@/components/home/buttons";
import { ChatClient } from "@/components/home/chat_client";
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
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [channelMenuId, setChannelMenuId] = useState<string | null>(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [friends, setFriends] = useState<UserPublic[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequestsResponse>({
        incoming: [],
        outgoing: [],
    });
    const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
    const [banningMemberId, setBanningMemberId] = useState<string | null>(null);

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

    const friendIds = useMemo(
        () => new Set(friends.map((friend) => friend.id)),
        [friends],
    );
    const outgoingRequestIds = useMemo(
        () =>
            new Set(
                friendRequests.outgoing.map((request) => request.user.id),
            ),
        [friendRequests],
    );
    const incomingRequestIds = useMemo(
        () =>
            new Set(
                friendRequests.incoming.map((request) => request.user.id),
            ),
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
                        fetchJson<{ channels: Channel[] }>(
                            `/api/servers/${serverId}/channels`
                        ),
                        fetchJson<{ members: ServerMember[] }>(
                            `/api/servers/${serverId}/members`
                        ),
                    ]);

                let friendsResp: { friends?: UserPublic[] } = {};
                let requestsResp: FriendRequestsResponse = {
                    incoming: [],
                    outgoing: [],
                };
                try {
                    friendsResp = await fetchJson<{ friends: UserPublic[] }>(
                        "/api/friends",
                    );
                } catch (error) {
                    console.warn("friends load failed", error);
                }
                try {
                    requestsResp = await fetchJson<FriendRequestsResponse>(
                        "/api/friends/requests",
                    );
                } catch (error) {
                    console.warn("friend requests load failed", error);
                }

                const serverData = serverResp.server;
                const channelList = channelsResp.channels;
                const memberList = membersResp.members;
                const friendList = friendsResp.friends ?? [];

                if (!cancelled) {
                    setMe(meResp.user);
                    setServer(serverData);
                    setChannels(channelList);
                    setMembers(memberList);
                    setActiveChannelId(channelList[0]?.id ?? "");
                    setFriends(friendList);
                    setFriendRequests(requestsResp);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : t("common.error"));
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
    }, [serverId, t]);

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
                                  status: wsEvent.data.user.status,
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
            if (wsEvent.type === "ServerMembersUpdated") {
                if (wsEvent.data.server_id !== serverId) {
                    return;
                }
                refreshMembers().catch(() => {});
            }
        });
    }, [ws, serverId]);

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
                if (typeof window !== "undefined") {
                    const cacheKey = `channel:${activeChannelId}:messages`;
                    const cached = sessionStorage.getItem(cacheKey);
                    if (cached) {
                        const parsed = JSON.parse(cached) as ChannelMessage[];
                        if (!cancelled && Array.isArray(parsed)) {
                            setMessages(parsed);
                        }
                    }
                }
            } catch {
                // ignore cache errors
            }
            try {
                const resp = await fetchJson<{ messages?: ChannelMessage[] }>(
                    `/api/channels/${activeChannelId}/messages?limit=50`
                );
                const list = resp.messages ?? [];
                if (!cancelled) {
                    const messageList = Array.isArray(list) ? list : [];
                    setMessages(messageList);
                    try {
                        if (typeof window !== "undefined") {
                            sessionStorage.setItem(
                                `channel:${activeChannelId}:messages`,
                                JSON.stringify(messageList),
                            );
                        }
                    } catch {
                        // ignore cache errors
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : t("common.error"));
                }
            } finally {
                if (!cancelled) {
                    setMessagesLoading(false);
                }
            }
        }
        loadMessages();
        return () => {
            cancelled = true;
        };
    }, [activeChannelId, t]);

    const refreshChannels = async () => {
        const resp = await fetchJson<{ channels: Channel[] }>(
            `/api/servers/${serverId}/channels`
        );
        const channelList = resp.channels;
        setChannels(channelList);
        if (!channelList.find((channel: Channel) => channel.id === activeChannelId)) {
            setActiveChannelId(channelList[0]?.id ?? "");
        }
    };

    const refreshMembers = async () => {
        try {
            const resp = await fetchJson<{ members: ServerMember[] }>(
                `/api/servers/${serverId}/members`
            );
            const memberList = resp.members;
            setMembers(memberList);
        } catch (error) {
            console.warn("refreshMembers failed", error);
        }
    };

    if (loading) {
        return <div style={{ padding: 24 }}>{t("common.loading")}</div>;
    }
    if (error) {
        return <div style={{ padding: 24, color: "red" }}>{error}</div>;
    }
    if (!server) {
        return <div style={{ padding: 24 }}>{t("server.server_not_found")}</div>;
    }

    const activeChannel = channels.find(
        (channel) => channel.id === activeChannelId,
    );

    const handleCreateChannel = async () => {
        const name = prompt(t("server.channel_name_prompt"));
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
            alert(t("server.channel_create_failed", { status: res.status, text }));
        }
    };

    const handleDeleteChannel = async (channelId: string) => {
        if (!confirm(t("common.delete") + " ?")) {
            return;
        }
        setChannelMenuId(null);
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
            alert(t("server.channel_rename_failed", { status: res.status, text }));
        }
    };

    const handleLeaveServer = async () => {
        if (!confirm(t("server.leave_confirm"))) {
            return;
        }
        const res = await fetch(`/api/servers/${serverId}/leave`, {
            method: "DELETE",
        });
        if (res.ok) {
            window.dispatchEvent(
                new CustomEvent("servers-remove", { detail: { id: serverId } }),
            );
            window.dispatchEvent(new Event("servers-refresh"));
            router.push("/home");
        } else if (res.status === 502) {
            window.dispatchEvent(
                new CustomEvent("servers-remove", { detail: { id: serverId } }),
            );
            window.dispatchEvent(new Event("servers-refresh"));
            router.push("/home");
        } else {
            const text = await res.text();
            alert(t("server.leave_failed", { status: res.status, text }));
            window.dispatchEvent(new Event("servers-refresh"));
        }
    };

    const handleDeleteServer = async () => {
        if (!confirm(t("server.delete_confirm"))) {
            return;
        }
        const res = await fetch(`/api/servers/${serverId}`, { method: "DELETE" });
        if (res.ok) {
            window.dispatchEvent(
                new CustomEvent("servers-remove", { detail: { id: serverId } }),
            );
            window.dispatchEvent(new Event("servers-refresh"));
            router.push("/home");
        } else if (res.status === 502) {
            window.dispatchEvent(
                new CustomEvent("servers-remove", { detail: { id: serverId } }),
            );
            window.dispatchEvent(new Event("servers-refresh"));
            router.push("/home");
        } else {
            const text = await res.text();
            alert(t("server.delete_server_failed", { status: res.status, text }));
            window.dispatchEvent(new Event("servers-refresh"));
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
                throw new Error(data?.error || t("server.invite_create_failed"));
            }
            const code = data?.code;
            setInviteCode(code ?? null);
            alert(t("server.invite_code_display", { code }));
        } catch (err) {
            alert(err instanceof Error ? err.message : t("server.invite_create_failed"));
        }
    };

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
        } catch (error) {
            console.error("Role update failed", error);
            alert(t("common.backend_unreachable"));
        }
    };

    const handleKickMember = async (userId: string) => {
        if (!window.confirm(t("server.kick_confirm"))) {
            return;
        }
        try {
            const res = await fetch(`/api/servers/${serverId}/members/${userId}`, {
                method: "DELETE",
            });
            if (res.ok || res.status === 502) {
                await refreshMembers();
                return;
            }
            const text = await res.text();
            alert(t("server.kick_failed", { status: res.status, text }));
        } catch (error) {
            console.error("Kick member failed", error);
            alert(t("common.backend_unreachable"));
        }
    };

    const handleBanMember = async (userId: string, durationMinutes: number | null) => {
        setBanningMemberId(null);
        try {
            const body: { duration_minutes?: number; reason?: string } = {};
            if (durationMinutes !== null) {
                body.duration_minutes = durationMinutes;
            }
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
        } catch (error) {
            console.error("Ban member failed", error);
            alert(t("common.backend_unreachable"));
        }
    };

    const handleAddFriend = async (member: ServerMember) => {
        if (!member.friend_code || addingFriendId) {
            return;
        }
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
            const request = data?.request;
            if (request) {
                setFriendRequests((prev) => ({
                    ...prev,
                    outgoing: [...prev.outgoing, request],
                }));
            }
        } catch (error) {
            console.error("Add friend failed", error);
            alert(t("common.backend_unreachable"));
        } finally {
            setAddingFriendId(null);
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
                            <span>{t("server.online_count", { count: members.filter((m) => m.online).length })}</span>
                        </div>
                    </div>
                </div>
                <div className="home-header-actions">
                    {isOwner ? (
                        <SecondaryButton
                            label={t("server.roles_btn")}
                            onClick={() => setShowRoleModal(true)}
                        />
                    ) : null}
                    {canInvite ? (
                        <button
                            className="home-btn home-btn-secondary"
                            style={{ padding: "10px 14px" }}
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

            <div className="home-body">
                <aside className="home-channels">
                    <div className="home-channels-title">
                        {t("server.channels")}
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
                                                        handleRenameChannel(channel.id);
                                                    }}
                                                >
                                                    {t("common.rename")}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDeleteChannel(channel.id);
                                                    }}
                                                >
                                                    {t("common.delete")}
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
                        isLoading={messagesLoading}
                    />

                    <aside className="home-members">
                        <div className="home-members-title">
                            {t("server.members")}
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
                                        <div className="home-member-line">
                                            <span className="home-member-name">
                                                {member.username}
                                            </span>
                                            <span
                                                className={`home-member-role home-member-role-${member.role}`}
                                            >
                                                {member.role}
                                            </span>
                                        </div>
                                        <span
                                            className={`home-member-status home-member-status-${
                                                member.online
                                                    ? member.status || "online"
                                                    : "offline"
                                            }`}
                                        >
                                            {member.online
                                                ? t(`status.${member.status || "online"}`, member.status || "online")
                                                : t("status.offline")}
                                        </span>
                                    </div>
                                    {member.user_id !== me?.id &&
                                    !friendIds.has(member.user_id) &&
                                    !outgoingRequestIds.has(member.user_id) &&
                                    !incomingRequestIds.has(member.user_id) ? (
                                        <button
                                            className="home-member-add"
                                            type="button"
                                            onClick={() => handleAddFriend(member)}
                                            disabled={addingFriendId === member.user_id}
                                            title={t("server.add_friend_title")}
                                        >
                                            +
                                        </button>
                                    ) : null}
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
                                <h3 className="home-modal-title">{t("server.roles_title")}</h3>
                                <p className="home-modal-subtitle">
                                    {t("server.roles_subtitle")}
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
                                        <div className="home-role-actions">
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
                                            <button
                                                className="home-role-kick"
                                                onClick={() =>
                                                    handleKickMember(member.user_id)
                                                }
                                            >
                                                {t("server.kick")}
                                            </button>
                                            {banningMemberId === member.user_id ? (
                                                <div className="home-ban-picker">
                                                    <select
                                                        className="home-role-select"
                                                        defaultValue=""
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            if (v === "") return;
                                                            handleBanMember(
                                                                member.user_id,
                                                                v === "permanent" ? null : parseInt(v),
                                                            );
                                                        }}
                                                    >
                                                        <option value="" disabled>{t("server.ban_duration_label")}</option>
                                                        <option value="permanent">{t("server.ban_permanent")}</option>
                                                        <option value="60">{t("server.ban_1h")}</option>
                                                        <option value="1440">{t("server.ban_24h")}</option>
                                                        <option value="10080">{t("server.ban_7d")}</option>
                                                        <option value="43200">{t("server.ban_30d")}</option>
                                                    </select>
                                                    <button
                                                        className="home-role-kick"
                                                        onClick={() => setBanningMemberId(null)}
                                                    >
                                                        {t("common.cancel")}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="home-role-kick"
                                                    onClick={() => setBanningMemberId(member.user_id)}
                                                >
                                                    {t("server.ban")}
                                                </button>
                                            )}
                                        </div>
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
                                {t("common.close")}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
