'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const GIF_RE = /^https?:\/\/.+\.(gif|webp)(\?.*)?$/i;

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];

export type MessageBubbleProps = {
    content: string;
    isMe: boolean;
    isTemp?: boolean;
    editedAt?: string | null;
    pinned?: boolean;
    reactions?: Record<string, number>;
    myReactions?: Set<string>;
    onAddReaction?: (emoji: string) => void;
    onRemoveReaction?: (emoji: string) => void;
    // channel variant only
    authorName?: string;
    createdAt?: string;
    // edit state (caller owns it)
    isEditing: boolean;
    editValue: string;
    onEditChange: (v: string) => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onStartEdit: () => void;
    onDelete: () => void;
    variant?: 'channel' | 'dm';
};

export function MessageBubble({
    content,
    isMe,
    isTemp = false,
    editedAt,
    pinned,
    reactions,
    myReactions,
    onAddReaction,
    onRemoveReaction,
    authorName,
    createdAt,
    isEditing,
    editValue,
    onEditChange,
    onSaveEdit,
    onCancelEdit,
    onStartEdit,
    onDelete,
    variant = 'dm',
}: MessageBubbleProps) {
    const { t } = useTranslation();
    const isChannel = variant === 'channel';
    const isGif = !isEditing && GIF_RE.test(content);
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!pickerOpen) return;
        const handler = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [pickerOpen]);

    const bubbleBase = isChannel
        ? clsx(
              'rounded-xl px-3 py-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.05)]',
              isMe
                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-500 text-white'
                  : 'bg-white',
          )
        : clsx(
              'w-full rounded-2xl px-4 py-2 text-sm shadow-sm',
              isEditing
                  ? 'border border-slate-200 bg-white text-slate-800'
                  : isMe
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-slate-800',
          );

    const editInput = (
        <div className="flex flex-col gap-2">
            <input
                value={editValue}
                onChange={(e) => onEditChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); onSaveEdit(); }
                    if (e.key === 'Escape') { e.preventDefault(); onCancelEdit(); }
                }}
                autoFocus
                className={clsx(
                    'rounded-lg border px-3 py-2 text-sm focus:outline-none',
                    isChannel
                        ? 'flex-1 border-slate-200 bg-slate-50 text-slate-950 transition-all focus:border-indigo-200 focus:bg-white focus:ring focus:ring-indigo-500/20'
                        : 'w-full border-slate-200 bg-white text-slate-900 focus:border-slate-400',
                )}
            />
            <div className={clsx('flex gap-2 text-xs', !isChannel && 'justify-end')}>
                <button
                    type="button"
                    onClick={onCancelEdit}
                    className={clsx(
                        'cursor-pointer border-0 bg-transparent p-0',
                        isChannel
                            ? 'text-slate-400 hover:text-slate-950'
                            : 'rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50',
                    )}
                >
                    {t('common.cancel')}
                </button>
                <button
                    type="button"
                    onClick={onSaveEdit}
                    disabled={!editValue.trim()}
                    className={clsx(
                        'cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
                        isChannel
                            ? 'border-0 bg-transparent p-0 text-slate-400 hover:text-slate-950'
                            : 'rounded-md bg-blue-500 px-2 py-1 font-semibold text-white hover:bg-blue-400',
                    )}
                >
                    {t('common.save')}
                </button>
            </div>
        </div>
    );

    const messageContent = isGif ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={content} alt="GIF" className="block max-w-[240px] rounded-lg" loading="lazy" />
    ) : isChannel ? (
        <div className={clsx('leading-relaxed', isMe ? 'text-white' : 'text-gray-800')}>
            {content}
        </div>
    ) : (
        <div className="flex flex-wrap items-baseline gap-2">
            <span className="whitespace-pre-wrap break-words">{content}</span>
            {editedAt ? (
                <span className={clsx('text-[10px]', isMe ? 'text-white/70' : 'text-slate-400')}>
                    {t('chat.edited')}
                </span>
            ) : null}
        </div>
    );

    const actions = isMe && !isEditing && !isTemp ? (
        isChannel ? (
            <div className="mt-1.5 flex gap-2.5 text-xs text-indigo-200">
                <button type="button" onClick={onStartEdit} className="cursor-pointer border-0 bg-transparent p-0 text-inherit hover:text-white">
                    {t('common.edit')}
                </button>
                <button type="button" onClick={onDelete} className="cursor-pointer border-0 bg-transparent p-0 text-inherit hover:text-white">
                    {t('common.delete')}
                </button>
            </div>
        ) : (
            <div className="mt-1 flex gap-2 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100">
                <button type="button" onClick={onStartEdit} className="hover:text-slate-600">
                    {t('common.edit')}
                </button>
                <button type="button" onClick={onDelete} className="hover:text-red-500">
                    {t('common.delete')}
                </button>
            </div>
        )
    ) : null;

    if (isChannel) {
        const hasReactions = reactions && Object.keys(reactions).length > 0;
        const canReact = !isTemp && (onAddReaction || onRemoveReaction);

        return (
            <div className={bubbleBase}>
                {authorName ? (
                    <div className={clsx('mb-1 flex items-center gap-2 text-[13px]', isMe && 'justify-end gap-3')}>
                        <span className={clsx('font-bold', isMe ? 'text-indigo-100' : 'text-slate-950')}>
                            {authorName}
                        </span>
                        {createdAt ? (
                            <span className={isMe ? 'text-indigo-200' : 'text-slate-400'}>
                                {new Date(createdAt).toLocaleTimeString()}
                            </span>
                        ) : null}
                        {editedAt ? (
                            <span className={clsx('text-[11px]', isMe ? 'text-indigo-200' : 'text-slate-400')}>
                                {t('chat.edited')}
                            </span>
                        ) : null}
                    </div>
                ) : null}
                {isEditing ? editInput : messageContent}
                {actions}
                {pinned ? <span className="mt-1 text-[11px] opacity-70">📌</span> : null}
                {(hasReactions || canReact) ? (
                    <div className="relative mt-1 flex flex-wrap items-center gap-1">
                        {hasReactions ? Object.entries(reactions!).map(([emoji, count]) => {
                            const reacted = myReactions?.has(emoji) ?? false;
                            return (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => reacted ? onRemoveReaction?.(emoji) : onAddReaction?.(emoji)}
                                    className={clsx(
                                        'cursor-pointer rounded-full px-2 py-0.5 text-xs transition',
                                        reacted
                                            ? isMe
                                                ? 'bg-white/40 ring-1 ring-white/60'
                                                : 'bg-indigo-100 ring-1 ring-indigo-300 text-indigo-700'
                                            : isMe
                                                ? 'bg-white/20 hover:bg-white/30'
                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700',
                                    )}
                                >
                                    {emoji} {count}
                                </button>
                            );
                        }) : null}
                        {canReact ? (
                            <div ref={pickerRef} className="relative">
                                <button
                                    type="button"
                                    title={t('chat.add_reaction')}
                                    onClick={() => setPickerOpen((v) => !v)}
                                    className={clsx(
                                        'cursor-pointer rounded-full px-1.5 py-0.5 text-xs transition',
                                        isMe
                                            ? 'text-indigo-200 hover:bg-white/20 hover:text-white'
                                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
                                    )}
                                >
                                    +
                                </button>
                                {pickerOpen ? (
                                    <div className={clsx(
                                        'absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg',
                                    )}>
                                        {QUICK_EMOJIS.map((e) => (
                                            <button
                                                key={e}
                                                type="button"
                                                onClick={() => {
                                                    const reacted = myReactions?.has(e) ?? false;
                                                    if (reacted) { onRemoveReaction?.(e); } else { onAddReaction?.(e); }
                                                    setPickerOpen(false);
                                                }}
                                                className={clsx(
                                                    'cursor-pointer rounded-lg p-1 text-base transition hover:bg-slate-100',
                                                    myReactions?.has(e) && 'bg-indigo-50',
                                                )}
                                            >
                                                {e}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    }

    // DM variant
    return (
        <div className={clsx('flex', isMe ? 'justify-end' : 'justify-start')}>
            <div className={clsx('group flex max-w-[70%] flex-col', isMe ? 'items-end' : 'items-start')}>
                <div className={bubbleBase}>
                    {isEditing ? editInput : messageContent}
                </div>
                {actions}
            </div>
        </div>
    );
}
