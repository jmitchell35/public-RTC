import Image from "next/image";
import { Server } from "@/lib/servers";

type Props = {
    servers: Server[];
    onAdd?: () => void;
    onSelect: (id: string) => void;
    activeId?: string;
};

export function ServerBar({ servers, onAdd, onSelect, activeId }: Props) {
    return (
        <aside className="home-servers">
            <div className="home-logo">Q</div>
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
