"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PrimaryButton } from "./buttons";
import { GifPicker } from "./gif-picker";
import { useHomeWs } from "@/components/home/home-ws-provider";
import type { ChannelMessage, ServerMember } from "@/lib/types";

type Props = {
    channelId: string;
    channelName?: string;
    initialMessages: ChannelMessage[];
    members: ServerMember[];
    currentUserId: string;
    isLoading?: boolean;
};

const TYPING_IDLE_MS = 1400;

function mergeMessages(
    existing: ChannelMessage[],
    incoming: ChannelMessage[],
) {
    const map = new Map(existing.map((message) => [message.id, message]));
    for (const message of incoming) {
        map.set(message.id, message);
    }
    return Array.from(map.values()).sort(
        (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    );
}

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
    const [typingUsers, setTypingUsers] = useState<Set<string>>(
        () => new Set(),
    );
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [actionError, setActionError] = useState<string | null>(null);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const pendingRef = useRef<Array<{ id: string; content: string }>>([]);
    const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const endRef = useRef<HTMLDivElement | null>(null);

    const memberMap = useMemo(() => {
        const map = new Map<string, string>();
        members.forEach((member) => map.set(member.user_id, member.username));
        return map;
    }, [members]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMessages((prev) => {
            const pending = prev.filter((message) =>
                message.id.startsWith("temp-"),
            );
            return mergeMessages(pending, initialMessages);
        });
    }, [initialMessages]);

    useEffect(() => {
        if (typeof window === "undefined" || !channelId) {
            return;
        }
        try {
            const limited = messages.slice(-50);
            sessionStorage.setItem(
                `channel:${channelId}:messages`,
                JSON.stringify(limited),
            );
        } catch {
            // ignore cache errors
        }
    }, [channelId, messages]);

    const isConnected = ws?.isConnected ?? false;

    useEffect(() => {
        if (!ws || !channelId || !isConnected) {
            return;
        }
        ws.send({ type: "JoinChannel", data: { channel_id: channelId } });
        return () => {
            ws.send({ type: "LeaveChannel", data: { channel_id: channelId } });
        };
    }, [ws, channelId, isConnected]);

    useEffect(() => {
        if (!ws) {
            return;
        }
        return ws.addListener((wsEvent) => {
            if (wsEvent.type === "Message") {
                const message = wsEvent.data.message;
                if (message.channel_id !== channelId) {
                    return;
                }
                if (message.author_id === currentUserId) {
                    const pendingIndex = pendingRef.current.findIndex(
                        (pending) => pending.content === message.content,
                    );
                    if (pendingIndex >= 0) {
                        const [pending] = pendingRef.current.splice(
                            pendingIndex,
                            1,
                        );
                        setMessages((prev) =>
                            prev.filter((item) => item.id !== pending.id),
                        );
                    }
                }
                setMessages((prev) => mergeMessages(prev, [message]));
            }
            if (wsEvent.type === "MessageUpdated") {
                const message = wsEvent.data.message;
                if (message.channel_id !== channelId) {
                    return;
                }
                setMessages((prev) => mergeMessages(prev, [message]));
                if (editingId === message.id) {
                    setEditingId(null);
                    setEditingValue("");
                }
            }
            if (wsEvent.type === "MessageDeleted") {
                if (wsEvent.data.channel_id !== channelId) {
                    return;
                }
                setMessages((prev) =>
                    prev.filter((message) => message.id !== wsEvent.data.message_id),
                );
                if (editingId === wsEvent.data.message_id) {
                    setEditingId(null);
                    setEditingValue("");
                }
            }
            if (wsEvent.type === "Typing") {
                if (wsEvent.data.channel_id !== channelId) {
                    return;
                }
                const userId = wsEvent.data.user_id;
                if (userId === currentUserId) {
                    return;
                }
                setTypingUsers((prev) => {
                    const next = new Set(prev);
                    if (wsEvent.data.is_typing) {
                        next.add(userId);
                    } else {
                        next.delete(userId);
                    }
                    return next;
                });
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
            ws?.send({
                type: "Typing",
                data: { channel_id: channelId, is_typing: typing },
            });
        },
        [ws, channelId],
    );

    useEffect(() => {
        return () => {
            if (typingTimeout.current) {
                clearTimeout(typingTimeout.current);
            }
            notifyTyping(false);
        };
    }, [channelId, notifyTyping]);

    const handleTyping = (value: string) => {
        setText(value);
        notifyTyping(true);
        if (typingTimeout.current) {
            clearTimeout(typingTimeout.current);
        }
        typingTimeout.current = setTimeout(() => {
            notifyTyping(false);
        }, TYPING_IDLE_MS);
    };

    async function sendMessage() {
        const content = text.trim();
        if (!content) {
            return;
        }
        setActionError(null);

        const tempId = `temp-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}`;
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
            ws.send({
                type: "SendMessage",
                data: { channel_id: channelId, content },
            });
            window.setTimeout(async () => {
                const stillPending = pendingRef.current.some(
                    (pending) => pending.id === tempId,
                );
                if (!stillPending) {
                    return;
                }
                try {
                    const res = await fetch(
                        `/api/channels/${channelId}/messages`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ content }),
                        },
                    );
                    if (!res.ok) {
                        setActionError(t("chat.send_failed"));
                        return;
                    }
                    const data = (await res.json()) as {
                        message?: ChannelMessage;
                    };
                    if (data?.message) {
                        pendingRef.current = pendingRef.current.filter(
                            (pending) => pending.id !== tempId,
                        );
                        setMessages((prev) =>
                            mergeMessages(
                                prev.filter((item) => item.id !== tempId),
                                [data.message!],
                            ),
                        );
                    }
                } catch (error) {
                    console.error("Fallback send failed", error);
                    setActionError(t("common.backend_unreachable"));
                }
            }, 2000);
            return;
        }

        try {
            const res = await fetch(`/api/channels/${channelId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });
            if (!res.ok) {
                setActionError(t("chat.send_failed"));
                return;
            }
            const data = (await res.json()) as { message?: ChannelMessage };
            if (data?.message) {
                pendingRef.current = pendingRef.current.filter(
                    (pending) => pending.id !== tempId,
                );
                setMessages((prev) =>
                    mergeMessages(
                        prev.filter((item) => item.id !== tempId),
                        [data.message!],
                    ),
                );
            }
        } catch (error) {
            console.error("Send message failed", error);
            setActionError(t("common.backend_unreachable"));
        }
    }

    const startEdit = (message: ChannelMessage) => {
        setEditingId(message.id);
        setEditingValue(message.content);
        setActionError(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingValue("");
    };

    const saveEdit = async () => {
        if (!editingId) {
            return;
        }
        const content = editingValue.trim();
        if (!content) {
            setActionError(t("chat.empty_message"));
            return;
        }
        setActionError(null);
        try {
            const res = await fetch(`/api/messages/${editingId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            });
            if (!res.ok) {
                setActionError(t("chat.update_failed"));
                return;
            }
            const data = (await res.json()) as { message?: ChannelMessage };
            if (data?.message) {
                setMessages((prev) => mergeMessages(prev, [data.message!]));
            }
            setEditingId(null);
            setEditingValue("");
        } catch (error) {
            console.error("Edit message failed", error);
            setActionError(t("common.backend_unreachable"));
        }
    };

    const removeMessage = async (message: ChannelMessage) => {
        if (!window.confirm(t("chat.delete_confirm"))) {
            return;
        }
        setActionError(null);
        try {
            const res = await fetch(`/api/messages/${message.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                setActionError(t("chat.delete_failed"));
                return;
            }
            setMessages((prev) =>
                prev.filter((item) => item.id !== message.id),
            );
        } catch (error) {
            console.error("Delete message failed", error);
            setActionError(t("common.backend_unreachable"));
        }
    };

    const typingLabel = typingNames.length === 1
        ? t("chat.typing_one", { name: typingNames[0] })
        : typingNames.length > 1
        ? t("chat.typing_multiple", { names: typingNames.join(", ") })
        : "";

    return (
        <div className="home-chat">
            {channelName ? (
                <div className="home-chat-header"># {channelName}</div>
            ) : null}
            <div className="home-chat-feed">
                {isLoading ? (
                    <div className="home-chat-loading">
                        <div className="home-chat-spinner" />
                        <span>{t("chat.loading_messages")}</span>
                    </div>
                ) : null}
                {isLoading && messages.length === 0 ? (
                    <div className="home-chat-skeleton">
                        <span />
                        <span />
                        <span />
                        <span />
                    </div>
                ) : null}
                {messages.map((message) => {
                    const author =
                        memberMap.get(message.author_id) ?? "Unknown";
                    const isMe = message.author_id === currentUserId;
                    const isEditing = editingId === message.id;
                    const isTemp = message.id.startsWith("temp-");
                    const isGif = /^https?:\/\/.+\.(gif|webp)(\?.*)?$/i.test(message.content);
                    return (
                        <div
                            key={message.id}
                            className={`home-chat-message ${
                                isMe ? "is-me" : "is-other"
                            }`}
                        >
                            <div className="home-chat-avatar">
                                {author[0] ?? "?"}
                            </div>
                            <div
                                className={`home-chat-bubble ${
                                    isMe ? "mine" : ""
                                }`}
                            >
                                <div className="home-chat-meta">
                                    <span className="home-chat-author">
                                        {author}
                                    </span>
                                    <span className="home-chat-time">
                                        {new Date(
                                            message.created_at,
                                        ).toLocaleTimeString()}
                                    </span>
                                    {message.edited_at ? (
                                        <span className="home-chat-edited">
                                            {t("chat.edited")}
                                        </span>
                                    ) : null}
                                </div>
                                {isEditing ? (
                                    <div className="home-chat-edit">
                                        <input
                                            value={editingValue}
                                            onChange={(event) =>
                                                setEditingValue(
                                                    event.target.value,
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    saveEdit();
                                                }
                                                if (event.key === "Escape") {
                                                    event.preventDefault();
                                                    cancelEdit();
                                                }
                                            }}
                                            className="home-input"
                                        />
                                        <div className="home-chat-actions">
                                            <button
                                                type="button"
                                                onClick={cancelEdit}
                                            >
                                                {t("common.cancel")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={saveEdit}
                                                disabled={!editingValue.trim()}
                                            >
                                                {t("common.save")}
                                            </button>
                                        </div>
                                    </div>
                                ) : isGif ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={message.content}
                                        alt="GIF"
                                        style={{ maxWidth: 240, borderRadius: 8, display: 'block' }}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="home-chat-text">
                                        {message.content}
                                    </div>
                                )}
                                {isMe && !isEditing && !isTemp ? (
                                    <div className="home-chat-actions">
                                        <button
                                            type="button"
                                            onClick={() => startEdit(message)}
                                        >
                                            {t("common.edit")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                removeMessage(message)
                                            }
                                        >
                                            {t("common.delete")}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>
            <div className="home-chat-input" style={{ position: 'relative' }}>
                <div className="home-chat-typing">
                    {typingLabel}
                    {actionError ? (
                        <span className="home-chat-error">{actionError}</span>
                    ) : null}
                </div>
                <div className="home-chat-compose">
                    {showGifPicker && (
                        <GifPicker
                            onSelect={(url) => {
                                setText(url);
                                setShowGifPicker(false);
                            }}
                            onClose={() => setShowGifPicker(false)}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => setShowGifPicker((v) => !v)}
                        style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#64748b',
                            whiteSpace: 'nowrap',
                        }}
                        title="Send a GIF"
                    >
                        GIF
                    </button>
                    <input
                        type="text"
                        placeholder={t("chat.send_placeholder")}
                        className="home-input"
                        value={text}
                        onChange={(event) => handleTyping(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                sendMessage();
                            }
                        }}
                        onBlur={() => notifyTyping(false)}
                    />
                    <PrimaryButton label={t("chat.send")} onClick={sendMessage} />
                </div>
            </div>
        </div>
    );
}
