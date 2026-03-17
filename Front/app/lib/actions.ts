'use server';

import { z } from 'zod';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchBackend } from './backend';
import { authFetch } from './auth-fetch';
import type { UserProfile } from './types';


const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    redirectTo: z.string().optional(),
});

const registerSchema = z.object({
    username: z.string().min(3).max(32),
    email: z.string().email(),
    password: z.string().min(8),
    redirectTo: z.string().optional(),
});

const updateSchema = z.object({
    username: z.string().min(3).max(32),
    email: z.string().email(),
    redirectTo: z.string().optional(),
});

const passwordUpdateSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    newPasswordConfirmation: z.string().min(8),
});

type AuthResponse = {
    token: string;
};


export async function authenticate(
    _prevState: string | undefined,
    formData: FormData,
) {
    const parsed = loginSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
        redirectTo: formData.get('redirectTo'),
    });

    if (!parsed.success) {
        return 'Invalid credentials.';
    }

    let response: Response;
    try {
        const result = await fetchBackend('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: parsed.data.email,
                password: parsed.data.password,
            }),
            cache: 'no-store',
        });
        response = result.response;
    } catch (error) {
        console.error('Auth login failed to reach backend', error);
        return 'Backend unreachable. Start the backend and check BACKEND_URL.';
    }

    if (!response.ok) {
        if (response.status === 401) {
            return 'Invalid credentials.';
        }
        if (response.status === 404) {
            return 'Backend not found. Check BACKEND_URL.';
        }
        return 'Something went wrong.';
    }

    const data = (await response.json()) as AuthResponse;
    if (!data?.token) {
        return 'Something went wrong.';
    }

    const cookieStore = await cookies();
    cookieStore.set('auth_token', data.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });

    redirect(parsed.data.redirectTo || '/home');
}

export async function registerUser(
    _prevState: string | undefined,
    formData: FormData,
) {
    const parsed = registerSchema.safeParse({
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        redirectTo: formData.get('redirectTo'),
    });

    if (!parsed.success) {
        return 'Invalid signup details.';
    }

    let response: Response;
    try {
        const result = await fetchBackend('/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: parsed.data.username,
                email: parsed.data.email,
                password: parsed.data.password,
            }),
            cache: 'no-store',
        });
        response = result.response;
    } catch (error) {
        console.error('Auth signup failed to reach backend', error);
        return 'Backend unreachable. Start the backend and check BACKEND_URL.';
    }

    if (!response.ok) {
        if (response.status === 409) {
            return 'Account already exists.';
        }
        if (response.status === 400) {
            return 'Invalid signup details.';
        }
        if (response.status === 404) {
            return 'Backend not found. Check BACKEND_URL.';
        }
        return 'Something went wrong.';
    }

    const data = (await response.json()) as AuthResponse;
    if (!data?.token) {
        return 'Something went wrong.';
    }

    const cookieStore = await cookies();
    cookieStore.set('auth_token', data.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });

    redirect(parsed.data.redirectTo || '/home');
}

export async function updateUser(
    _prevState: string | undefined,
    formData: FormData,
) {
    const parsed = updateSchema.safeParse({
        username: formData.get('username'),
        email: formData.get('email'),
        redirectTo: formData.get('redirectTo'),
    });

    if (!parsed.success) {
        return 'Invalid update details.';
    }

    const currentPassword = String(formData.get('currentPassword') ?? '');
    const newPassword = String(formData.get('newPassword') ?? '');
    const newPasswordConfirmation = String(
        formData.get('newPasswordConfirmation') ?? '',
    );

    if (newPassword || currentPassword || newPasswordConfirmation) {
        const parsedPassword = passwordUpdateSchema.safeParse({
            currentPassword,
            newPassword,
            newPasswordConfirmation,
        });
        if (!parsedPassword.success) {
            return 'Invalid password details.';
        }
        if (newPassword !== newPasswordConfirmation) {
            return 'Passwords do not match.';
        }
    }

    let meResponse: Response;
    try {
        meResponse = await authFetch('/me', { method: 'GET' });
    } catch (error) {
        console.error('Profile lookup failed', error);
        return 'Backend unreachable. Start the backend and check BACKEND_URL.';
    }

    if (!meResponse.ok) {
        return 'Unauthorized';
    }

    const meData = (await meResponse.json()) as { user: { id: string } };
    const userId = meData?.user?.id;
    if (!userId) {
        return 'Unauthorized';
    }

    const payload: Record<string, string> = {
        username: parsed.data.username,
        email: parsed.data.email,
    };
    if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
    }

    let response: Response;
    try {
        response = await authFetch(`/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error('Profile update failed', error);
        return 'Backend unreachable. Start the backend and check BACKEND_URL.';
    }

    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        if (response.status === 409) {
            return 'Account already exists.';
        }
        if (response.status === 400) {
            return errorBody?.error ?? 'Invalid update details.';
        }
        return errorBody?.error ?? 'Something went wrong.';
    }

    redirect(parsed.data.redirectTo || '/home');
}

export async function deleteAccount(
    _prevState: string | undefined,
    formData: FormData,
) {
    const redirectTo = String(formData.get('redirectTo') ?? '/login');
    let meResponse: Response;
    try {
        meResponse = await authFetch('/me', { method: 'GET' });
    } catch (error) {
        console.error('Profile lookup failed', error);
        return 'Backend unreachable. Start the backend and check BACKEND_URL.';
    }

    if (!meResponse.ok) {
        return 'Unauthorized';
    }

    const meData = (await meResponse.json()) as { user: { id: string } };
    const userId = meData?.user?.id;
    if (!userId) {
        return 'Unauthorized';
    }

    let response: Response;
    try {
        response = await authFetch(`/users/${userId}`, {
            method: 'DELETE',
        });
    } catch (error) {
        console.error('Account deletion failed', error);
        return 'Backend unreachable. Start the backend and check BACKEND_URL.';
    }

    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        return errorBody?.error ?? 'Something went wrong.';
    }

    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
    redirect(redirectTo || '/login');
}

export async function fetchProfile(): Promise<UserProfile | null> {
    let meResponse: Response;
    try {
        meResponse = await authFetch('/me', { method: 'GET' });
    } catch (error) {
        console.error('Profile lookup failed', error);
        return null;
    }

    if (!meResponse.ok) {
        return null;
    }

    const meData = (await meResponse.json()) as { user: { id: string } };
    const userId = meData?.user?.id;
    if (!userId) {
        return null;
    }

    try {
        const response = await authFetch(`/users/${userId}`, { method: 'GET' });
        if (!response.ok) {
            return null;
        }
        const data = (await response.json()) as { user: UserProfile };
        return data.user ?? null;
    } catch (error) {
        console.error('Profile fetch failed', error);
        return null;
    }
}
