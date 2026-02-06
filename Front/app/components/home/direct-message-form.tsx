'use client';

import { useActionState } from 'react';
import { sendDirectMessage } from '@/lib/dm-actions';

type DirectMessageFormProps = {
    friendId: string;
};

export default function DirectMessageForm({ friendId }: DirectMessageFormProps) {
    const [errorMessage, formAction, isPending] = useActionState(
        sendDirectMessage,
        undefined,
    );

    return (
        <form action={formAction} className="flex flex-col gap-2">
            <input type="hidden" name="friendId" value={friendId} />
            <div className="flex items-center gap-2">
                <input
                    name="content"
                    type="text"
                    placeholder="Send a message"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                    required
                />
                <button
                    type="submit"
                    disabled={isPending}
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
