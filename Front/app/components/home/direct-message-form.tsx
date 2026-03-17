'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GifPicker } from './gif-picker';

type DirectMessageFormProps = {
    onSend: (content: string) => Promise<string | null>;
    onTyping?: (isTyping: boolean) => void;
};

export default function DirectMessageForm({
    onSend,
    onTyping,
}: DirectMessageFormProps) {
    const { t } = useTranslation();
    const [value, setValue] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingActive = useRef(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) {
            setErrorMessage(t('chat.empty_message'));
            return;
        }
        setErrorMessage(null);
        setValue('');
        onTyping?.(false);
        const error = await onSend(trimmed);
        if (error) {
            setErrorMessage(error);
        }
    };

    const handleTyping = (nextValue: string) => {
        setValue(nextValue);
        if (!onTyping) {
            return;
        }
        if (!typingActive.current) {
            typingActive.current = true;
            onTyping(true);
        }
        if (typingTimeout.current) {
            clearTimeout(typingTimeout.current);
        }
        typingTimeout.current = setTimeout(() => {
            typingActive.current = false;
            onTyping(false);
        }, 1500);
    };

    useEffect(() => {
        return () => {
            if (typingTimeout.current) {
                clearTimeout(typingTimeout.current);
            }
            if (typingActive.current) {
                onTyping?.(false);
            }
        };
    }, [onTyping]);

    const selectGif = async (url: string) => {
        setShowGifPicker(false);
        const error = await onSend(url);
        if (error) {
            setErrorMessage(error);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="relative flex items-center gap-2">
                {showGifPicker && (
                    <GifPicker
                        onSelect={selectGif}
                        onClose={() => setShowGifPicker(false)}
                    />
                )}
                <button
                    type="button"
                    onClick={() => setShowGifPicker((v) => !v)}
                    className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                    title={t('gif.send_gif')}
                >
                    GIF
                </button>
                <input
                    name="content"
                    type="text"
                    placeholder={t('chat.send_placeholder')}
                    value={value}
                    onChange={(event) => handleTyping(event.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                    required
                />
                <button
                    type="submit"
                    disabled={!value.trim()}
                    className="rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {t('chat.send')}
                </button>
            </div>
            {errorMessage && (
                <span className="text-xs text-red-500">{errorMessage}</span>
            )}
        </form>
    );
}
