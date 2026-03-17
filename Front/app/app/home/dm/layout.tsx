import { getFriends } from '@/lib/friend-actions';
import DmSidebar from '@/components/home/dm-sidebar';

export const dynamic = 'force-dynamic';

export default async function DmLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const friends = await getFriends();

    return (
        <div className="home-body">
            <DmSidebar friends={friends} />
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {children}
            </div>
        </div>
    );
}
