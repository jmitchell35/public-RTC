'use client';

import Image from "next/image";
import Link from "next/link";
import { HomeIcon } from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

type Props = {
    servers: Array<{ id: string; name: string; icon: string; notif?: number }>;
    onAdd?: () => void;
    onSelect: (id: string) => void;
    activeId?: string;
};

export function ServerBar({ servers, onAdd, onSelect, activeId }: Props) {
    const { t } = useTranslation();
    return (
        <aside className="flex h-full w-20 flex-col items-center gap-3 overflow-x-hidden overflow-y-auto bg-[#0b1224] py-4 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <Link
                className="grid h-12 w-12 cursor-pointer place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 text-lg font-bold text-inherit no-underline transition-transform hover:-translate-y-px hover:shadow-[0_10px_24px_rgba(99,102,241,0.35)]"
                href="/home/dm"
                aria-label="Home"
            >
                <HomeIcon className="h-6 w-6 text-white" />
            </Link>
            <div className="h-px w-10 bg-gray-800" />
            <nav className="flex flex-col gap-3">
                {servers.map((s) => (
                    <button
                        key={s.id}
                        className={clsx(
                            "relative grid h-12 w-12 cursor-pointer place-items-center rounded-2xl border-0 text-white text-xl transition-all hover:scale-105 hover:bg-[#1f2a45]",
                            s.id === activeId
                                ? "bg-[#1f2a45] outline outline-2 outline-indigo-500"
                                : "bg-[#161f35]",
                        )}
                        title={s.name}
                        onClick={() => onSelect(s.id)}
                    >
                        <span className="text-lg">{s.icon}</span>
                        {s.notif ? (
                            <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-xs font-bold text-white">
                                {s.notif}
                            </span>
                        ) : null}
                    </button>
                ))}
            </nav>
            <div className="flex-1" />
            <button
                className="grid h-12 w-12 cursor-pointer place-items-center rounded-2xl border-0 bg-[#161f35] text-2xl text-white transition-all hover:scale-105 hover:bg-[#1f2a45]"
                title={t('shell.add_server')}
                onClick={onAdd}
            >
                +
            </button>
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white">
                <Image src="/avatar.png" alt={t('common.me')} width={48} height={48} className="rounded-2xl" />
            </div>
        </aside>
    );
}
