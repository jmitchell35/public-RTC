'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { lusitana } from '@/lib/fonts';

type ProfileClientProps = {
    userId: string;
};

type ProfileFormState = {
    username: string;
    email: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
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

export default function ProfileClient({ userId }: ProfileClientProps) {
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [form, setForm] = useState<ProfileFormState>({
        username: '',
        email: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const status = useMemo(
        () => getStatus(profile?.status),
        [profile?.status],
    );

    useEffect(() => {
        let active = true;
        const loadProfile = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/users/${userId}`, {
                    method: 'GET',
                });
                if (!active) {
                    return;
                }
                if (response.status === 401) {
                    router.replace('/login');
                    return;
                }
                if (response.status === 403 || response.status === 404) {
                    setError('Unable to access this profile.');
                    setIsLoading(false);
                    return;
                }
                if (!response.ok) {
                    setError('Unable to load profile.');
                    setIsLoading(false);
                    return;
                }
                const data = (await response.json()) as { user: UserProfile };
                if (!active) {
                    return;
                }
                setProfile(data.user);
                setForm({
                    username: data.user.username,
                    email: data.user.email,
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                });
                setIsLoading(false);
            } catch {
                if (active) {
                    setError(
                        'Backend unreachable. Start the backend and check BACKEND_URL.',
                    );
                    setIsLoading(false);
                }
            }
        };

        loadProfile();

        return () => {
            active = false;
        };
    }, [userId, router]);

    const handleChange = (field: keyof ProfileFormState, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();
        if (!profile) {
            return;
        }
        setError(null);
        setSuccess(null);

        const username = form.username.trim();
        const email = form.email.trim();
        if (!username || !email) {
            setError('Username and email are required.');
            return;
        }

        if (form.newPassword) {
            if (form.newPassword.length < 8) {
                setError('Password must be at least 8 characters.');
                return;
            }
            if (form.newPassword !== form.confirmPassword) {
                setError('Passwords do not match.');
                return;
            }
            if (!form.currentPassword.trim()) {
                setError('Current password is required to change password.');
                return;
            }
        }

        const payload: Record<string, string> = {};
        if (username !== profile.username) {
            payload.username = username;
        }
        if (email !== profile.email) {
            payload.email = email;
        }
        if (form.newPassword) {
            payload.current_password = form.currentPassword;
            payload.new_password = form.newPassword;
        }

        if (Object.keys(payload).length === 0) {
            setError('No changes to save.');
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (response.status === 401) {
                router.replace('/login');
                return;
            }
            if (!response.ok) {
                const data = (await response
                    .json()
                    .catch(() => null)) as { error?: string } | null;
                setError(data?.error ?? 'Something went wrong.');
                return;
            }
            const data = (await response.json()) as { user: UserProfile };
            setProfile(data.user);
            setForm({
                username: data.user.username,
                email: data.user.email,
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
            setSuccess('Profile updated.');
        } catch {
            setError(
                'Backend unreachable. Start the backend and check BACKEND_URL.',
            );
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <main className="min-h-screen bg-[#eef2f7] text-slate-900">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
                    <div className="h-6 w-32 rounded-full bg-slate-200" />
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-4 pb-6">
                            <div className="h-14 w-14 rounded-full bg-slate-200" />
                            <div className="space-y-2">
                                <div className="h-4 w-40 rounded-full bg-slate-200" />
                                <div className="h-3 w-28 rounded-full bg-slate-100" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="h-10 rounded-lg bg-slate-100" />
                            <div className="h-10 rounded-lg bg-slate-100" />
                            <div className="h-10 rounded-lg bg-slate-100" />
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    if (error && !profile) {
        return (
            <main className="min-h-screen bg-[#eef2f7] text-slate-900">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <h1 className={`${lusitana.className} text-xl`}>
                            {error}
                        </h1>
                        <p className="mt-2 text-sm text-slate-500">
                            Please return to your friends list.
                        </p>
                        <Link
                            href="/home"
                            className="mt-4 inline-flex rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
                        >
                            Back to home
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    if (!profile) {
        return null;
    }

    return (
        <main className="min-h-screen bg-[#eef2f7] text-slate-900">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className={`${lusitana.className} text-2xl`}>
                            Profile
                        </h1>
                        <p className="text-sm text-slate-500">
                            Update your account details.
                        </p>
                    </div>
                    <Link
                        href="/home"
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        Back to home
                    </Link>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 pb-6">
                        <div className="relative h-14 w-14">
                            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-900" />
                            <span
                                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${status.dot}`}
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-semibold text-slate-800">
                                {profile.username}
                            </span>
                            <span className="text-xs text-slate-500">
                                Friend code: {profile.friend_code}
                            </span>
                        </div>
                        <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {status.label}
                        </span>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5 pt-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="text-xs font-semibold text-slate-600">
                                Username
                                <input
                                    type="text"
                                    value={form.username}
                                    onChange={(event) =>
                                        handleChange(
                                            'username',
                                            event.target.value,
                                        )
                                    }
                                    minLength={3}
                                    maxLength={32}
                                    required
                                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                                />
                            </label>
                            <label className="text-xs font-semibold text-slate-600">
                                Email
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(event) =>
                                        handleChange(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                    required
                                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                                />
                            </label>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-4">
                            <div className="text-xs font-semibold text-slate-600">
                                Password
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                Leave blank if you do not want to change your
                                password.
                            </p>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <label className="text-xs font-semibold text-slate-600">
                                    Current password
                                    <input
                                        type="password"
                                        value={form.currentPassword}
                                        onChange={(event) =>
                                            handleChange(
                                                'currentPassword',
                                                event.target.value,
                                            )
                                        }
                                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                                    />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                    New password
                                    <input
                                        type="password"
                                        value={form.newPassword}
                                        onChange={(event) =>
                                            handleChange(
                                                'newPassword',
                                                event.target.value,
                                            )
                                        }
                                        minLength={8}
                                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                                    />
                                </label>
                                <label className="text-xs font-semibold text-slate-600 md:col-span-2">
                                    Confirm new password
                                    <input
                                        type="password"
                                        value={form.confirmPassword}
                                        onChange={(event) =>
                                            handleChange(
                                                'confirmPassword',
                                                event.target.value,
                                            )
                                        }
                                        minLength={8}
                                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                                    />
                                </label>
                            </div>
                        </div>

                        {error ? (
                            <div className="text-xs text-red-500">{error}</div>
                        ) : null}
                        {success ? (
                            <div className="text-xs text-emerald-600">
                                {success}
                            </div>
                        ) : null}

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSaving ? 'Saving...' : 'Save changes'}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
