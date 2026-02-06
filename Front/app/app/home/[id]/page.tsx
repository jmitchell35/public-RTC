import Link from 'next/link';
import { getDirectMessages } from '@/lib/dm-actions';
import { getMe } from '@/lib/friend-actions';
import DirectMessageForm from '@/components/home/direct-message-form';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

type DirectMessagePageProps = {
    params: { id: string };
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

export default async function DirectMessagePage({ params }: DirectMessagePageProps) {
    const [meResponse, dm] = await Promise.all([
        getMe(),
        getDirectMessages(params.id),
    ]);

    if (!dm || !meResponse?.user) {
        return null;
    }

    const me = meResponse.user;
    const status = getStatus(dm.friend.status);

    return (
        <main className="flex min-h-screen flex-col bg-[#eef2f7] text-slate-900">
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/home"
                        className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                    </Link>
                    <div className="relative h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900" />
                        <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${status.dot}`}
                        />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-slate-800">
                            {dm.friend.username}
                        </div>
                        <div className="text-xs text-slate-500">
                            {status.label}
                        </div>
                    </div>
                </div>
                <span className="text-xs text-slate-400">
                    Friend code: {dm.friend.friend_code}
                </span>
            </header>

            <section className="flex flex-1 flex-col gap-4 px-6 py-6">
                <div className="flex-1 space-y-3 overflow-y-auto">
                    {dm.messages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
                            No messages yet. Say hello to start the conversation.
                        </div>
                    ) : (
                        dm.messages.map((message) => {
                            const isMe = message.author_id === me.id;
                            return (
                                <div
                                    key={message.id}
                                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                                            isMe
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white text-slate-800'
                                        }`}
                                    >
                                        {message.content}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <DirectMessageForm friendId={params.id} />
                </div>
            </section>
        </main>
    );
}
