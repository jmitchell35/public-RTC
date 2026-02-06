'use client';

import { useEffect, useRef, useState } from 'react';

type DirectMessageFormProps = {
    onSend: (content: string) => Promise<string | null>;
    onTyping?: (isTyping: boolean) => void;
};

export default function DirectMessageForm({
    onSend,
    onTyping,
}: DirectMessageFormProps) {
    const [value, setValue] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingActive = useRef(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) {
            setErrorMessage('Message cannot be empty.');
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

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <input
                    name="content"
                    type="text"
                    placeholder="Send a message"
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
                    Send
                </button>
            </div>
            {errorMessage && (
                <span className="text-xs text-red-500">{errorMessage}</span>
            )}
        </form>
    );
}
