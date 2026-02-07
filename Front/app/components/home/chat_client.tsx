"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PrimaryButton } from "./buttons";
import { useHomeWs } from "@/components/home/home-ws-provider";
import type { ChannelMessage, ServerMember } from "@/lib/types";

type Props = {
    channelId: string;
    initialMessages: ChannelMessage[];
    members: ServerMember[];
    currentUserId: string;
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
    initialMessages,
    members,
    currentUserId,
}: Props) {
    const ws = useHomeWs();
    const [messages, setMessages] =
        useState<ChannelMessage[]>(initialMessages);
    const [text, setText] = useState("");
    const [typingUsers, setTypingUsers] = useState<Set<string>>(
        () => new Set(),
    );
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [actionError, setActionError] = useState<string | null>(null);
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
        const names = Array.from(typingUsers)
            .map((id) => memberMap.get(id) ?? "Someone")
            .filter(Boolean);
        return names;
    }, [typingUsers, memberMap]);

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
                        setActionError("Failed to send message.");
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
                                [data.message],
                            ),
                        );
                    }
                } catch (error) {
                    console.error("Fallback send failed", error);
                    setActionError("Backend unreachable.");
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
                setActionError("Failed to send message.");
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
                        [data.message],
                    ),
                );
            }
        } catch (error) {
            console.error("Send message failed", error);
            setActionError("Backend unreachable.");
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
            setActionError("Message cannot be empty.");
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
                setActionError("Failed to update message.");
                return;
            }
            const data = (await res.json()) as { message?: ChannelMessage };
            if (data?.message) {
                setMessages((prev) => mergeMessages(prev, [data.message]));
            }
            setEditingId(null);
            setEditingValue("");
        } catch (error) {
            console.error("Edit message failed", error);
            setActionError("Backend unreachable.");
        }
    };

    const removeMessage = async (message: ChannelMessage) => {
        if (!window.confirm("Delete this message?")) {
            return;
        }
        setActionError(null);
        try {
            const res = await fetch(`/api/messages/${message.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                setActionError("Failed to delete message.");
                return;
            }
            setMessages((prev) =>
                prev.filter((item) => item.id !== message.id),
            );
        } catch (error) {
            console.error("Delete message failed", error);
            setActionError("Backend unreachable.");
        }
    };

    return (
        <div className="home-chat">
            <div className="home-chat-feed">
                {messages.map((message) => {
                    const author =
                        memberMap.get(message.author_id) ?? "Unknown";
                    const isMe = message.author_id === currentUserId;
                    const isEditing = editingId === message.id;
                    const isTemp = message.id.startsWith("temp-");
                    return (
                        <div key={message.id} className="home-chat-message">
                            <div className="home-chat-avatar">
                                {author[0] ?? "?"}
                            </div>
                            <div className="home-chat-bubble">
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
                                            edited
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
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={saveEdit}
                                                disabled={!editingValue.trim()}
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
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
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                removeMessage(message)
                                            }
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>
            <div className="home-chat-input">
                <div className="home-chat-typing">
                    {typingNames.length > 0
                        ? `${typingNames.join(", ")} is typing...`
                        : ""}
                    {actionError ? (
                        <span className="home-chat-error">{actionError}</span>
                    ) : null}
                </div>
                <div className="home-chat-compose">
                    <input
                        type="text"
                        placeholder="Envoyer un message"
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
                    <PrimaryButton label="Envoyer" onClick={sendMessage} />
                </div>
            </div>
        </div>
    );
}
