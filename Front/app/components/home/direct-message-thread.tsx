'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import type { DirectMessage, UserPublic } from '@/lib/types';
import { mergeMessages } from '@/lib/messages';
import DirectMessageForm from '@/components/home/direct-message-form';
import { useHomeWs } from '@/components/home/home-ws-provider';
import { MessageBubble } from '@/components/home/message-bubble';

type DirectMessageThreadProps = {
    me: UserPublic;
    friend: UserPublic;
    initialMessages: DirectMessage[];
};

const statusDots: Record<string, string> = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-400',
    dnd: 'bg-red-500',
};


export default function DirectMessageThread({
    me,
    friend,
    initialMessages,
}: DirectMessageThreadProps) {
    const { t } = useTranslation();
    const ws = useHomeWs();
    const [messages, setMessages] = useState<DirectMessage[]>(initialMessages);
    const [friendState, setFriendState] = useState<UserPublic>(friend);
    const [isTyping, setIsTyping] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement | null>(null);

    const status = useMemo(() => ({
        label: t(`status.${friendState.status ?? 'offline'}`, t('status.offline')),
        dot: statusDots[friendState.status ?? 'offline'] ?? statusDots.offline,
    }), [friendState.status, t]);

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
                const msg = wsEvent.data.message;
                setMessages((prev) => {
                    if (msg.author_id === me.id) {
                        const firstTemp = prev.find((m) =>
                            m.id.startsWith('temp-'),
                        );
                        if (firstTemp) {
                            return mergeMessages(
                                prev.filter((m) => m.id !== firstTemp.id),
                                [msg],
                            );
                        }
                    }
                    return mergeMessages(prev, [msg]);
                });
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
    }, [ws, friendState.id, editingId, me.id]);

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
                    return t('dm.login_again');
                }
                setMessages((prev) =>
                    prev.filter((message) => message.id !== tempId),
                );
                return t('dm.something_wrong');
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
            return t('common.backend_unreachable');
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
            setActionError(t('chat.empty_message'));
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
                    setActionError(t('dm.login_again'));
                    return;
                }
                if (response.status === 403) {
                    setActionError(t('dm.edit_own_only'));
                    return;
                }
                if (response.status === 404) {
                    setActionError(t('dm.msg_not_found'));
                    return;
                }
                setActionError(t('dm.something_wrong'));
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
            setActionError(t('common.backend_unreachable'));
        }
    };

    const removeMessage = async (message: DirectMessage) => {
        if (!window.confirm(t('chat.delete_confirm'))) {
            return;
        }
        setActionError(null);
        try {
            const response = await fetch(`/api/dm/messages/${message.id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                if (response.status === 401) {
                    setActionError(t('dm.login_again'));
                    return;
                }
                if (response.status === 403) {
                    setActionError(t('dm.delete_own_only'));
                    return;
                }
                if (response.status === 404) {
                    setActionError(t('dm.msg_not_found'));
                    return;
                }
                setActionError(t('dm.something_wrong'));
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
            setActionError(t('common.backend_unreachable'));
        }
    };

    return (
        <main className="flex h-full flex-col bg-[#eef2f7] text-slate-900">
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
                    {t('dm.friend_code', { code: friendState.friend_code })}
                </span>
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-6">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                    {messages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                            {t('dm.no_messages')}
                        </div>
                    ) : (
                        messages.map((message) => {
                            const isMe = message.author_id === me.id;
                            const isEditing = editingId === message.id;
                            const isTemp = message.id.startsWith('temp-');
                            return (
                                <MessageBubble
                                    key={message.id}
                                    variant="dm"
                                    content={message.content}
                                    isMe={isMe}
                                    isTemp={isTemp}
                                    editedAt={message.edited_at}
                                    isEditing={isEditing}
                                    editValue={editingValue}
                                    onEditChange={setEditingValue}
                                    onSaveEdit={saveEdit}
                                    onCancelEdit={cancelEdit}
                                    onStartEdit={() => startEdit(message)}
                                    onDelete={() => removeMessage(message)}
                                />
                            );
                        })
                    )}
                    <div ref={endRef} />
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="mb-2 text-xs text-slate-500">
                        {isTyping ? t('chat.typing_one', { name: friendState.username }) : ''}
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
