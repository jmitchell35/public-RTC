'use client';

import { lusitana } from '@/lib/fonts';
import {
    AtSymbolIcon,
    KeyIcon,
    ExclamationCircleIcon,
    UserIcon,
} from '@heroicons/react/24/outline';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { UpdateButton } from '@/components/profile/update-button';
import { useActionState } from 'react';
import { deleteAccount, updateUser } from '@/lib/actions';
import { useSearchParams } from 'next/navigation';
import type { UserProfile } from '@/lib/types';

export default function ProfileForm({
                                        user,
                                    }: {
    user: UserProfile | null;
}) {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/home';
    const [errorMessage, formAction, isPending] = useActionState(
        updateUser,
        undefined,
    );
    const [deleteError, deleteAction, isDeleting] = useActionState(
        deleteAccount,
        undefined,
    );

    if (!user) {
        return (
            <div className="rounded-lg bg-gray-50 px-6 pb-4 pt-8">
                <h1 className={`${lusitana.className} mb-3 text-2xl`}>
                    Your profile.
                </h1>
                <p className="text-sm text-gray-500">
                    Unable to load profile. Please sign in again.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <form action={formAction}>
                <div className="flex-1 rounded-lg bg-gray-50 px-6 pb-4 pt-8">
                <h1 className={`${lusitana.className} mb-3 text-2xl`}>
                    Your profile.
                </h1>
                <div className="w-full">
                    <div>
                        <label
                            className="mb-3 mt-5 block text-xs font-medium text-gray-900"
                            htmlFor="username"
                        >
                            Username
                        </label>
                        <div className="relative" suppressHydrationWarning>
                            <input
                                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                                id="username"
                                type="text"
                                name="username"
                                defaultValue={user.username}
                                placeholder="Enter your username"
                                required
                                minLength={3}
                                maxLength={32}
                                suppressHydrationWarning
                            />
                            <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label
                            className="mb-3 mt-5 block text-xs font-medium text-gray-900"
                            htmlFor="email"
                        >
                            Email
                        </label>
                        <div className="relative" suppressHydrationWarning>
                            <input
                                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                                id="email"
                                type="email"
                                name="email"
                                defaultValue={user.email}
                                placeholder="Enter your email address"
                                required
                                suppressHydrationWarning
                            />
                            <AtSymbolIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label
                            className="mb-3 mt-5 block text-xs font-medium text-gray-900"
                            htmlFor="currentPassword"
                        >
                            Current password
                        </label>
                        <div className="relative" suppressHydrationWarning>
                            <input
                                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                                id="currentPassword"
                                type="password"
                                name="currentPassword"
                                defaultValue=""
                                placeholder="Type your current password"
                                suppressHydrationWarning
                            />
                            <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label
                            className="mb-3 mt-5 block text-xs font-medium text-gray-900"
                            htmlFor="newPassword"
                        >
                            New password
                        </label>
                        <div className="relative" suppressHydrationWarning>
                            <input
                                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                                id="newPassword"
                                type="password"
                                name="newPassword"
                                defaultValue=""
                                placeholder="Type in new password"
                                suppressHydrationWarning
                            />
                            <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label
                            className="mb-3 mt-5 block text-xs font-medium text-gray-900"
                            htmlFor="newPasswordConfirmation"
                        >
                            New password confirmation
                        </label>
                        <div className="relative" suppressHydrationWarning>
                            <input
                                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                                id="newPasswordConfirmation"
                                type="password"
                                name="newPasswordConfirmation"
                                defaultValue=""
                                placeholder="Confirm new password"
                                suppressHydrationWarning
                            />
                            <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
                        </div>
                    </div>
                </div>
                <input type="hidden" name="redirectTo" value={callbackUrl} />
                <UpdateButton className="mt-4 w-full" aria-disabled={isPending}>
                    Update profile <ArrowRightIcon className="ml-auto h-5 w-5 text-gray-50" />
                </UpdateButton>
                <div
                    className="flex h-8 items-end space-x-1"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {errorMessage && (
                        <>
                            <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                            <p className="text-sm text-red-500">{errorMessage}</p>
                        </>
                    )}
                </div>
                </div>
            </form>
            <form
                action={deleteAction}
                onSubmit={(event) => {
                    if (
                        !window.confirm(
                            'Supprimer définitivement votre compte ?',
                        )
                    ) {
                        event.preventDefault();
                    }
                }}
            >
                <input type="hidden" name="redirectTo" value="/login" />
                <button
                    type="submit"
                    disabled={isDeleting}
                    className="w-full rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Supprimer mon compte
                </button>
                {deleteError ? (
                    <p className="mt-2 text-sm text-red-500">{deleteError}</p>
                ) : null}
            </form>
        </div>
    );
}
