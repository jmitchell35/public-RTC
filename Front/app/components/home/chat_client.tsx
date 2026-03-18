"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { PrimaryButton } from "./buttons";
import { GifPicker } from "./gif-picker";
import { useHomeWs } from "@/components/home/home-ws-provider";
import { MessageBubble } from "@/components/home/message-bubble";
import type { ChannelMessage, MessageReaction, ServerMember } from "@/lib/types";
import { mergeMessages } from "@/lib/messages";

type Props = {
    channelId: string;
    channelName?: string;
    initialMessages: ChannelMessage[];
    members: ServerMember[];
    currentUserId: string;
    isLoading?: boolean;
};

const TYPING_IDLE_MS = 1400;

export function ChatClient({
    channelId,
    channelName,
    initialMessages,
    members,
    currentUserId,
    isLoading = false,
}: Props) {
    const { t } = useTranslation();
    const ws = useHomeWs();
    const [messages, setMessages] = useState<ChannelMessage[]>(() =>
        mergeMessages([], initialMessages),
    );
    const [text, setText] = useState("");
    const [typingUsers, setTypingUsers] = useState<Set<string>>(() => new Set());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [actionError, setActionError] = useState<string | null>(null);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({});
    const pendingRef = useRef<Array<{ id: string; content: string }>>([]);
    const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const endRef = useRef<HTMLDivElement | null>(null);

    const memberMap = useMemo(() => {
        const map = new Map<string, string>();
        members.forEach((m) => map.set(m.user_id, m.username));
        return map;
    }, [members]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMessages((prev) => {
            const pending = prev.filter((m) => m.id.startsWith("temp-"));
            return mergeMessages(pending, initialMessages);
        });
    }, [initialMessages]);

    useEffect(() => {
        if (typeof window === "undefined" || !channelId) return;
        try {
            sessionStorage.setItem(
                `channel:${channelId}:messages`,
                JSON.stringify(messages.slice(-50)),
            );
        } catch { /* ignore */ }
    }, [channelId, messages]);

    const isConnected = ws?.isConnected ?? false;

    useEffect(() => {
        if (!ws || !channelId || !isConnected) return;
        ws.send({ type: "JoinChannel", data: { channel_id: channelId } });
        return () => { ws.send({ type: "LeaveChannel", data: { channel_id: channelId } }); };
    }, [ws, channelId, isConnected]);

    useEffect(() => {
        if (!ws) return;
        return ws.addListener((wsEvent) => {
            if (wsEvent.type === "Message") {
                const message = wsEvent.data.message;
                if (message.channel_id !== channelId) return;
                if (message.author_id === currentUserId) {
                    const pendingIndex = pendingRef.current.findIndex(
                        (p) => p.content === message.content,
                    );
                    if (pendingIndex >= 0) {
                        const [pending] = pendingRef.current.splice(pendingIndex, 1);
                        setMessages((prev) => prev.filter((m) => m.id !== pending.id));
                    }
                }
                setMessages((prev) => mergeMessages(prev, [message]));
            }
            if (wsEvent.type === "MessageUpdated") {
                const message = wsEvent.data.message;
                if (message.channel_id !== channelId) return;
                setMessages((prev) => mergeMessages(prev, [message]));
                if (editingId === message.id) { setEditingId(null); setEditingValue(""); }
            }
            if (wsEvent.type === "MessageDeleted") {
                if (wsEvent.data.channel_id !== channelId) return;
                setMessages((prev) => prev.filter((m) => m.id !== wsEvent.data.message_id));
                if (editingId === wsEvent.data.message_id) { setEditingId(null); setEditingValue(""); }
            }
            if (wsEvent.type === "Typing") {
                if (wsEvent.data.channel_id !== channelId) return;
                const userId = wsEvent.data.user_id;
                if (userId === currentUserId) return;
                setTypingUsers((prev) => {
                    const next = new Set(prev);
                    if (wsEvent.data.is_typing) { next.add(userId); } else { next.delete(userId); }
                    return next;
                });
            }
            if (wsEvent.type === "MessagePinned") {
                if (wsEvent.data.channel_id !== channelId) return;
                const { message_id, pinned } = wsEvent.data;
                setMessages((prev) => prev.map((m) => m.id === message_id ? { ...m, pinned } : m));
            }
            if (wsEvent.type === "ReactionAdded") {
                if (wsEvent.data.channel_id !== channelId) return;
                const { message_id, reaction } = wsEvent.data;
                setReactions((prev) => {
                    const existing = prev[message_id] ?? [];
                    const deduped = existing.filter(
                        (r) => !(r.user_id === reaction.user_id && r.emoji === reaction.emoji),
                    );
                    return { ...prev, [message_id]: [...deduped, reaction] };
                });
            }
            if (wsEvent.type === "ReactionRemoved") {
                if (wsEvent.data.channel_id !== channelId) return;
                const { message_id, user_id, emoji } = wsEvent.data;
                setReactions((prev) => ({
                    ...prev,
                    [message_id]: (prev[message_id] ?? []).filter(
                        (r) => !(r.user_id === user_id && r.emoji === emoji),
                    ),
                }));
            }
        });
    }, [ws, channelId, currentUserId, editingId]);

    const typingNames = useMemo(() => {
        return Array.from(typingUsers)
            .map((id) => memberMap.get(id) ?? t("common.unknown", "Someone"))
            .filter(Boolean);
    }, [typingUsers, memberMap, t]);

    const notifyTyping = useCallback(
        (typing: boolean) => {
            ws?.send({ type: "Typing", data: { channel_id: channelId, is_typing: typing } });
        },
        [ws, channelId],
    );

    useEffect(() => {
        return () => {
            if (typingTimeout.current) clearTimeout(typingTimeout.current);
            notifyTyping(false);
        };
    }, [channelId, notifyTyping]);

    const handleTyping = (value: string) => {
        setText(value);
        notifyTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => notifyTyping(false), TYPING_IDLE_MS);
    };

    async function sendMessage() {
        const content = text.trim();
        if (!content) return;
        setActionError(null);
        const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const tempMessage: ChannelMessage = {
            id: tempId,
            channel_id: channelId,
            author_id: currentUserId,
            content,
            created_at: new Date().toISOString(),
        };
        pendingRef.current.push({ id: tempId, content });
        setMessages((prev) => mergeMessages(prev, [tempMessage]));
        setText("");
        notifyTyping(false);

        if (ws?.isConnected) {
            ws.send({ type: "SendMessage", data: { channel_id: channelId, content } });
            window.setTimeout(async () => {
                const stillPending = pendingRef.current.some((p) => p.id === tempId);
                if (!stillPending) return;
                try {
                    const res = await fetch(`/api/channels/${channelId}/messages`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content }),
                    });
                    if (!res.ok) { setActionError(t("chat.send_failed")); return; }
                    const data = (await res.json()) as { message?: ChannelMessage };
                    if (data?.message) {
                        pendingRef.current = pendingRef.current.filter((p) => p.id !== tempId);
                        setMessages((prev) =>
                            mergeMessages(prev.filter((m) => m.id !== tempId), [data.message!]),
                        );
                    }
                } catch { setActionError(t("common.backend_unreachable")); }
            }, 2000);
            return;
        }

        try {
            const res = await fetch(`/api/channels/${channelId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });
            if (!res.ok) { setActionError(t("chat.send_failed")); return; }
            const data = (await res.json()) as { message?: ChannelMessage };
            if (data?.message) {
                pendingRef.current = pendingRef.current.filter((p) => p.id !== tempId);
                setMessages((prev) =>
                    mergeMessages(prev.filter((m) => m.id !== tempId), [data.message!]),
                );
            }
        } catch { setActionError(t("common.backend_unreachable")); }
    }

    const startEdit = (message: ChannelMessage) => {
        setEditingId(message.id);
        setEditingValue(message.content);
        setActionError(null);
    };

    const cancelEdit = () => { setEditingId(null); setEditingValue(""); };

    // Reset reactions when switching channels to avoid stale data
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReactions({});
    }, [channelId]);

    // Fetch reactions whenever the message list for this channel is available
    useEffect(() => {
        const ids = initialMessages.map((m) => m.id).filter((id) => !id.startsWith("temp-"));
        if (ids.length === 0) return;
        Promise.allSettled(
            ids.map((id) =>
                fetch(`/api/messages/${id}/reactions`)
                    .then((r) => r.ok ? r.json() : null)
                    .then((data: { reactions?: MessageReaction[] } | null) => {
                        if (data?.reactions?.length) {
                            setReactions((prev) => ({ ...prev, [id]: data.reactions! }));
                        }
                    }),
            ),
        ).catch(() => {});
    }, [initialMessages]);

    const syncReactions = useCallback(async (messageId: string) => {
        try {
            const res = await fetch(`/api/messages/${messageId}/reactions`);
            if (!res.ok) return;
            const data = (await res.json()) as { reactions?: MessageReaction[] };
            if (data?.reactions) {
                setReactions((prev) => ({ ...prev, [messageId]: data.reactions! }));
            }
        } catch { /* ignore */ }
    }, []);

    const addReaction = async (messageId: string, emoji: string) => {
        try {
            const res = await fetch(`/api/messages/${messageId}/reactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emoji }),
            });
            if (!res.ok) {
                if (res.status === 409) {
                    // Reaction already exists in DB but not in local state — sync it
                    await syncReactions(messageId);
                    return;
                }
                setActionError(t("chat.reaction_failed"));
            }
        } catch { setActionError(t("common.backend_unreachable")); }
    };

    const removeReaction = async (messageId: string, emoji: string) => {
        try {
            const res = await fetch(`/api/messages/${messageId}/reactions`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emoji }),
            });
            if (!res.ok) { setActionError(t("chat.reaction_failed")); }
        } catch { setActionError(t("common.backend_unreachable")); }
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const content = editingValue.trim();
        if (!content) { setActionError(t("chat.empty_message")); return; }
        setActionError(null);
        try {
            const res = await fetch(`/api/messages/${editingId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });
            if (!res.ok) { setActionError(t("chat.update_failed")); return; }
            const data = (await res.json()) as { message?: ChannelMessage };
            if (data?.message) setMessages((prev) => mergeMessages(prev, [data.message!]));
            setEditingId(null);
            setEditingValue("");
        } catch { setActionError(t("common.backend_unreachable")); }
    };

    const removeMessage = async (message: ChannelMessage) => {
        if (!window.confirm(t("chat.delete_confirm"))) return;
        setActionError(null);
        try {
            const res = await fetch(`/api/messages/${message.id}`, { method: "DELETE" });
            if (!res.ok) { setActionError(t("chat.delete_failed")); return; }
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
        } catch { setActionError(t("common.backend_unreachable")); }
    };

    const typingLabel =
        typingNames.length === 1
            ? t("chat.typing_one", { name: typingNames[0] })
            : typingNames.length > 1
            ? t("chat.typing_multiple", { names: typingNames.join(", ") })
            : "";

    return (
        <div className="flex flex-col bg-slate-50">
            {channelName ? (
                <div className="border-b border-slate-200 bg-white px-5 py-3.5 font-bold text-slate-950">
                    # {channelName}
                </div>
            ) : null}

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
                {isLoading ? (
                    <div className="mb-3 flex items-center gap-2.5 text-[13px] text-slate-500">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
                        <span>{t("chat.loading_messages")}</span>
                    </div>
                ) : null}
                {isLoading && messages.length === 0 ? (
                    <div className="mb-3 flex flex-col gap-2.5">
                        <div className="h-3.5 w-[60%] animate-pulse rounded-full bg-slate-200" />
                        <div className="h-3.5 w-[80%] animate-pulse rounded-full bg-slate-200" />
                        <div className="h-3.5 w-[55%] animate-pulse rounded-full bg-slate-200" />
                        <div className="h-3.5 w-[70%] animate-pulse rounded-full bg-slate-200" />
                    </div>
                ) : null}
                {messages.map((message) => {
                    const author = memberMap.get(message.author_id) ?? "Unknown";
                    const isMe = message.author_id === currentUserId;
                    const isEditing = editingId === message.id;
                    const isTemp = message.id.startsWith("temp-");
                    const msgReactionList = reactions[message.id] ?? [];
                    const msgReactions = msgReactionList.reduce<Record<string, number>>(
                        (acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] ?? 0) + 1 }),
                        {},
                    );
                    const myReactions = new Set(
                        msgReactionList.filter((r) => r.user_id === currentUserId).map((r) => r.emoji),
                    );
                    const reactionUsers = msgReactionList.reduce<Record<string, string[]>>((acc, r) => {
                        const name = r.user_id === currentUserId
                            ? t("common.me")
                            : (memberMap.get(r.user_id) ?? t("common.unknown", "Unknown"));
                        return { ...acc, [r.emoji]: [...(acc[r.emoji] ?? []), name] };
                    }, {});

                    return (
                        <div
                            key={message.id}
                            className={clsx("flex gap-3", isMe && "flex-row-reverse")}
                        >
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-600 font-bold text-white">
                                {author[0] ?? "?"}
                            </div>
                            <MessageBubble
                                variant="channel"
                                content={message.content}
                                isMe={isMe}
                                isTemp={isTemp}
                                editedAt={message.edited_at}
                                pinned={message.pinned}
                                reactions={msgReactions}
                                myReactions={myReactions}
                                reactionUsers={reactionUsers}
                                onAddReaction={(emoji) => addReaction(message.id, emoji)}
                                onRemoveReaction={(emoji) => removeReaction(message.id, emoji)}
                                authorName={author}
                                createdAt={message.created_at}
                                isEditing={isEditing}
                                editValue={editingValue}
                                onEditChange={setEditingValue}
                                onSaveEdit={saveEdit}
                                onCancelEdit={cancelEdit}
                                onStartEdit={() => startEdit(message)}
                                onDelete={() => removeMessage(message)}
                            />
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>

            <div className="relative flex flex-col gap-2.5 border-t border-slate-200 bg-white px-4 py-3.5">
                <div className="text-xs text-slate-500">
                    {typingLabel}
                    {actionError ? (
                        <span className="ml-2 text-red-500">{actionError}</span>
                    ) : null}
                </div>
                <div className="flex items-center gap-3">
                    {showGifPicker && (
                        <GifPicker
                            onSelect={(url) => { setText(url); setShowGifPicker(false); }}
                            onClose={() => setShowGifPicker(false)}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => setShowGifPicker((v) => !v)}
                        className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                        title="Send a GIF"
                    >
                        GIF
                    </button>
                    <input
                        type="text"
                        placeholder={t("chat.send_placeholder")}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm outline-none transition-all focus:border-indigo-200 focus:bg-white focus:ring focus:ring-indigo-500/20"
                        value={text}
                        onChange={(e) => handleTyping(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                        onBlur={() => notifyTyping(false)}
                    />
                    <PrimaryButton label={t("chat.send")} onClick={sendMessage} />
                </div>
            </div>
        </div>
    );
}
