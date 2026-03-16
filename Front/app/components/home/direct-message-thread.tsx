'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import type { DirectMessage, UserPublic } from '@/lib/types';
import DirectMessageForm from '@/components/home/direct-message-form';
import { useHomeWs } from '@/components/home/home-ws-provider';

type DirectMessageThreadProps = {
    me: UserPublic;
    friend: UserPublic;
    initialMessages: DirectMessage[];
};

const statusStyles: Record<string, { label: string; dot: string }> = {
    online: { label: 'Online', dot: 'bg-emerald-500' },
    offline: { label: 'Offline', dot: 'bg-slate-400' },
    dnd: { label: 'Do Not Disturb', dot: 'bg-red-500' },
};

function getStatus(status?: string) {
    if (!status) {
        return statusStyles.offline;
    }
    return statusStyles[status] ?? statusStyles.offline;
}

function mergeMessages(
    existing: DirectMessage[],
    incoming: DirectMessage[],
) {
    const map = new Map(existing.map((message) => [message.id, message]));
    for (const message of incoming) {
        map.set(message.id, message);
    }
    return Array.from(map.values()).sort(
        (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    );
}

export default function DirectMessageThread({
    me,
    friend,
    initialMessages,
}: DirectMessageThreadProps) {
    const ws = useHomeWs();
    const [messages, setMessages] = useState<DirectMessage[]>(initialMessages);
    const [friendState, setFriendState] = useState<UserPublic>(friend);
    const [isTyping, setIsTyping] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement | null>(null);

    const status = useMemo(
        () => getStatus(friendState.status),
        [friendState.status],
    );

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    useEffect(() => {
        if (!ws) {
            return;
        }
        return ws.addListener((wsEvent) => {
            if (
                wsEvent.type === 'DirectMessage' &&
                wsEvent.data.friend_id === friendState.id
            ) {
                setMessages((prev) =>
                    mergeMessages(prev, [wsEvent.data.message]),
                );
            }
            if (
                wsEvent.type === 'DirectMessageUpdated' &&
                wsEvent.data.friend_id === friendState.id
            ) {
                setMessages((prev) =>
                    mergeMessages(prev, [wsEvent.data.message]),
                );
                if (editingId === wsEvent.data.message.id) {
                    setEditingId(null);
                    setEditingValue('');
                }
            }
            if (
                wsEvent.type === 'DirectMessageDeleted' &&
                wsEvent.data.friend_id === friendState.id
            ) {
                setMessages((prev) =>
                    prev.filter(
                        (message) =>
                            message.id !== wsEvent.data.message_id,
                    ),
                );
                if (editingId === wsEvent.data.message_id) {
                    setEditingId(null);
                    setEditingValue('');
                }
            }
            if (
                wsEvent.type === 'FriendStatusUpdated' &&
                wsEvent.data.user.id === friendState.id
            ) {
                setFriendState(wsEvent.data.user);
            }
            if (
                wsEvent.type === 'DirectTyping' &&
                wsEvent.data.friend_id === friendState.id
            ) {
                setIsTyping(wsEvent.data.is_typing);
            }
        });
    }, [ws, friendState.id, editingId]);

    const sendTyping = (typing: boolean) => {
        ws?.send({
            type: 'DirectTyping',
            data: { friend_id: friendState.id, is_typing: typing },
        });
    };

    const sendMessage = async (content: string) => {
        const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const tempMessage: DirectMessage = {
            id: tempId,
            conversation_id: 'temp',
            author_id: me.id,
            content,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => mergeMessages(prev, [tempMessage]));

        try {
            const response = await fetch(`/api/dm/${friendState.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            if (!response.ok) {
                if (response.status === 401) {
                    setMessages((prev) =>
                        prev.filter((message) => message.id !== tempId),
                    );
                    return 'Please log in again.';
                }
                setMessages((prev) =>
                    prev.filter((message) => message.id !== tempId),
                );
                return 'Something went wrong.';
            }
            const data = (await response.json()) as {
                messages?: DirectMessage[];
            };
            if (data?.messages) {
                setMessages((prev) =>
                    mergeMessages(
                        prev.filter((message) => message.id !== tempId),
                        data.messages!,
                    ),
                );
            } else {
                setMessages((prev) =>
                    prev.filter((message) => message.id !== tempId),
                );
            }
            return null;
        } catch (error) {
            console.error('Direct message send failed', error);
            setMessages((prev) =>
                prev.filter((message) => message.id !== tempId),
            );
            return 'Backend unreachable. Start the backend and check BACKEND_URL.';
        }
    };

    const startEdit = (message: DirectMessage) => {
        setEditingId(message.id);
        setEditingValue(message.content);
        setActionError(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingValue('');
        setActionError(null);
    };

    const saveEdit = async () => {
        if (!editingId) {
            return;
        }
        const content = editingValue.trim();
        if (!content) {
            setActionError('Message cannot be empty.');
            return;
        }
        setActionError(null);
        try {
            const response = await fetch(`/api/dm/messages/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
            if (!response.ok) {
                if (response.status === 401) {
                    setActionError('Please log in again.');
                    return;
                }
                if (response.status === 403) {
                    setActionError('You can only edit your own messages.');
                    return;
                }
                if (response.status === 404) {
                    setActionError('Message not found.');
                    return;
                }
                setActionError('Something went wrong.');
                return;
            }
            const data = (await response.json()) as {
                message?: DirectMessage;
            };
            if (data?.message) {
                setMessages((prev) =>
                    mergeMessages(prev, [data.message as DirectMessage]),
                );
            }
            setEditingId(null);
            setEditingValue('');
        } catch (error) {
            console.error('Direct message edit failed', error);
            setActionError(
                'Backend unreachable. Start the backend and check BACKEND_URL.',
            );
        }
    };

    const removeMessage = async (message: DirectMessage) => {
        if (!window.confirm('Delete this message?')) {
            return;
        }
        setActionError(null);
        try {
            const response = await fetch(`/api/dm/messages/${message.id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                if (response.status === 401) {
                    setActionError('Please log in again.');
                    return;
                }
                if (response.status === 403) {
                    setActionError('You can only delete your own messages.');
                    return;
                }
                if (response.status === 404) {
                    setActionError('Message not found.');
                    return;
                }
                setActionError('Something went wrong.');
                return;
            }
            setMessages((prev) =>
                prev.filter((item) => item.id !== message.id),
            );
            if (editingId === message.id) {
                cancelEdit();
            }
        } catch (error) {
            console.error('Direct message delete failed', error);
            setActionError(
                'Backend unreachable. Start the backend and check BACKEND_URL.',
            );
        }
    };

    return (
        <main className="flex min-h-screen flex-col bg-[#eef2f7] text-slate-900">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/home"
                        className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                    </Link>
                    <div className="relative h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900" />
                        <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${status.dot}`}
                        />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-slate-800">
                            {friendState.username}
                        </div>
                        <div className="text-xs text-slate-500">
                            {status.label}
                        </div>
                    </div>
                </div>
                <span className="text-xs text-slate-400">
                    Friend code: {friendState.friend_code}
                </span>
            </header>

            <section className="flex flex-1 flex-col gap-4 px-6 py-6">
                <div className="flex-1 space-y-3 overflow-y-auto">
                    {messages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                            No messages yet. Say hello to start the conversation.
                        </div>
                    ) : (
                        messages.map((message) => {
                            const isMe = message.author_id === me.id;
                            const isEditing = editingId === message.id;
                            const isTemp = message.id.startsWith('temp-');
                            const bubbleClass = isEditing
                                ? 'bg-white text-slate-800 border border-slate-200'
                                : isMe
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-slate-800';
                            return (
                                <div
                                    key={message.id}
                                    className={`flex ${
                                        isMe ? 'justify-end' : 'justify-start'
                                    }`}
                                >
                                    <div
                                        className={`group flex max-w-[70%] flex-col ${
                                            isMe ? 'items-end' : 'items-start'
                                        }`}
                                    >
                                        <div
                                            className={`w-full rounded-2xl px-4 py-2 text-sm shadow-sm ${bubbleClass}`}
                                        >
                                            {isEditing ? (
                                                <div className="flex flex-col gap-2">
                                                    <input
                                                        value={editingValue}
                                                        onChange={(event) =>
                                                            setEditingValue(
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                        onKeyDown={(event) => {
                                                            if (
                                                                event.key ===
                                                                'Enter'
                                                            ) {
                                                                event.preventDefault();
                                                                saveEdit();
                                                            }
                                                            if (
                                                                event.key ===
                                                                'Escape'
                                                            ) {
                                                                event.preventDefault();
                                                                cancelEdit();
                                                            }
                                                        }}
                                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end gap-2 text-xs">
                                                        <button
                                                            type="button"
                                                            onClick={cancelEdit}
                                                            className="rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={saveEdit}
                                                            disabled={
                                                                !editingValue.trim()
                                                            }
                                                            className="rounded-md bg-blue-500 px-2 py-1 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap items-baseline gap-2">
                                                    <span className="whitespace-pre-wrap break-words">
                                                        {message.content}
                                                    </span>
                                                    {message.edited_at ? (
                                                        <span
                                                            className={`text-[10px] ${
                                                                isMe
                                                                    ? 'text-white/70'
                                                                    : 'text-slate-400'
                                                            }`}
                                                        >
                                                            edited
                                                        </span>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                        {isMe && !isEditing && !isTemp ? (
                                            <div className="mt-1 flex gap-2 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        startEdit(message)
                                                    }
                                                    className="hover:text-slate-600"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeMessage(message)
                                                    }
                                                    className="hover:text-red-500"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={endRef} />
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="mb-2 text-xs text-slate-500">
                        {isTyping ? `${friendState.username} is typing...` : ''}
                    </div>
                    {actionError ? (
                        <div className="mb-2 text-xs text-red-500">
                            {actionError}
                        </div>
                    ) : null}
                    <DirectMessageForm
                        onSend={sendMessage}
                        onTyping={sendTyping}
                    />
                </div>
            </section>
        </main>
    );
}
