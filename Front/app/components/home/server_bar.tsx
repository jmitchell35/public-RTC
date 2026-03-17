'use client';

import Image from "next/image";
import Link from "next/link";
import { HomeIcon } from "@heroicons/react/24/solid";

type Props = {
    servers: Array<{ id: string; name: string; icon: string; notif?: number }>;
    onAdd?: () => void;
    onSelect: (id: string) => void;
    activeId?: string;
};

export function ServerBar({ servers, onAdd, onSelect, activeId }: Props) {
    return (
        <aside className="home-servers">
            <Link className="home-logo home-logo-btn" href="/home/dm" aria-label="Home">
                <HomeIcon className="h-6 w-6 text-white" />
            </Link>
            <div className="home-divider" />
            <nav className="home-servers-list">
                {servers.map((s) => (
                    <button
                        key={s.id}
                        className={`home-server-btn ${s.id === activeId ? "is-active" : ""}`}
                        title={s.name}
                        onClick={() => onSelect(s.id)}
                    >
                        <span className="home-server-icon">{s.icon}</span>
                        {s.notif ? <span className="home-server-badge">{s.notif}</span> : null}
                    </button>
                ))}
            </nav>
            <div className="home-spacer" />
            <button
                className="home-server-btn home-server-add"
                title="Ajouter un serveur"
                onClick={onAdd}
            >
                +
            </button>
            <div className="home-avatar">
                <Image src="/avatar.png" alt="Moi" width={48} height={48} className="home-avatar-img" />
            </div>
        </aside>
    );
}
