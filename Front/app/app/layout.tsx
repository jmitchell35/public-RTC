import '@/styles/globals.css';
import { inter } from '@/lib/fonts';
import { Metadata } from 'next';
import { I18nProvider } from '@/components/i18n-provider';

export const metadata: Metadata = {
    title: {
        template: '%s | RTC',
        default: 'RTC',
    },
    description: 'Real-time chat application.',
    metadataBase: new URL('https://next-learn-dashboard.vercel.sh'),
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="fr">
            <body className={`${inter.className} antialiased`}>
                <I18nProvider>{children}</I18nProvider>
            </body>
        </html>
    );
}
