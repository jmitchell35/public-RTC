import { cookies } from 'next/headers';
import HomeWsProvider from '@/components/home/home-ws-provider';

export default async function HomeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value ?? null;
    const wsBaseUrls = [
        process.env.NEXT_PUBLIC_BACKEND_WS_URL,
        process.env.BACKEND_URL,
        process.env.NEXT_PUBLIC_BACKEND_URL,
    ]
        .filter(Boolean)
        .join(',');

    return (
        <HomeWsProvider wsToken={token} wsBaseUrls={wsBaseUrls}>
            {children}
        </HomeWsProvider>
    );
}
