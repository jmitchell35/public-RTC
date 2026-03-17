import LogoComponent from "@/components/logo_component";
import RegisterForm from '@/components/register/register-form';
import Link from 'next/link';
import { Suspense } from 'react';

import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Sign up',
};

export default function RegisterPage() {
    return (
        <main className="flex items-center justify-center md:h-screen">
            <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4 md:-mt-32">
                <Link href="/" className="flex h-20 w-full items-end rounded-lg bg-blue-500 p-3 md:h-36">
                    <LogoComponent />
                </Link>
                <Suspense>
                    <RegisterForm />
                </Suspense>
            </div>
        </main>
    );
}
