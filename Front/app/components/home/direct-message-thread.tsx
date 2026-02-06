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
    }, [ws, friendState.id]);

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
                        data.messages,
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
                            return (
                                <div
                                    key={message.id}
                                    className={`flex ${
                                        isMe ? 'justify-end' : 'justify-start'
                                    }`}
                                >
                                    <div
                                        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                                            isMe
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white text-slate-800'
                                        }`}
                                    >
                                        {message.content}
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
                    <DirectMessageForm
                        onSend={sendMessage}
                        onTyping={sendTyping}
                    />
                </div>
            </section>
        </main>
    );
}
