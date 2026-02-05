import '@/styles/globals.css';
import { inter } from '@/lib/fonts';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: {
        template: '%s | RTC',
        default: 'RTC',
    },
    description: 'The official Next.js Learn Dashboard built with App Router.',
    metadataBase: new URL('https://next-learn-dashboard.vercel.sh'),
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
        <body className={`${inter.className} antialiased`}>{children}</body>
        </html>
    );
}