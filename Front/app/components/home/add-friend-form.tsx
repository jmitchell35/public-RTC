'use client';

import { useState } from 'react';

type AddFriendFormProps = {
    friendCode?: string;
    onSendRequest: (friendCode: string) => Promise<string | null>;
};

export default function AddFriendForm({
    friendCode,
    onSendRequest,
}: AddFriendFormProps) {
    const [value, setValue] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isPending) {
            return;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            setErrorMessage('Enter a friend code.');
            return;
        }
        setIsPending(true);
        const error = await onSendRequest(trimmed);
        setIsPending(false);
        setErrorMessage(error);
        if (!error) {
            setValue('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                    name="friendCode"
                    type="text"
                    placeholder="Enter a friend code"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                    required
                />
                <button
                    type="submit"
                    disabled={isPending}
                    className="whitespace-nowrap rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Send Request
                </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                    Your friend code:{' '}
                    <span className="font-semibold text-slate-700">
                        {friendCode ?? '...'}
                    </span>
                </span>
                {errorMessage && (
                    <span className="text-red-500">{errorMessage}</span>
                )}
            </div>
        </form>
    );
}
