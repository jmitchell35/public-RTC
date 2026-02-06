'use server';

import { z } from 'zod';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchBackend } from './backend';

// Schema to match data against
// const FormSchema = z.object({
//     id: z.string(),
//     customerId: z.string({
//         invalid_type_error: 'Please select a customer.',
//     }),
//     amount: z.coerce.number()
//         .gt(0, { message: 'Please enter an amount greater than $0.' }),
//     status: z.enum(['pending', 'paid'], {
//         invalid_type_error: 'Please select an invoice status.',
//     }),
//     date: z.string(),
// });

// export type State = {
//     errors?: {
//         customerId?: string[];
//         amount?: string[];
//         status?: string[];
//     };
//     message?: string | null;
// };

// schema values which don't need to come from the user input
// const CreateInvoice = FormSchema.omit({id: true, date: true});
// const UpdateInvoice = FormSchema.omit({ id: true, date: true });

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
