'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Gif = { id: string; title: string; url: string; preview: string };

type GifPickerProps = {
    onSelect: (url: string) => void;
    onClose: () => void;
};

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<Gif[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const fetchGifs = async (q: string) => {
        setLoading(true);
        setError(null);
        try {
            const url = q.trim()
                ? `/api/gifs?q=${encodeURIComponent(q.trim())}&limit=8`
                : `/api/gifs?limit=8`;
            const res = await fetch(url);
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                setError(data?.error ?? 'Failed to load GIFs');
                return;
            }
            const data = await res.json();
            setGifs(data.results ?? []);
        } catch {
            setError('Failed to load GIFs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchGifs(''); }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const handleQueryChange = (value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchGifs(value), 400);
    };

    return (
        <div
            ref={containerRef}
            className="absolute bottom-full left-0 right-0 z-[100] mb-2 flex h-[33vh] flex-col overflow-hidden rounded-xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
        >
            <div className="border-b border-slate-100 px-2.5 py-2">
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder={t('gif.search_placeholder')}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none"
                />
            </div>
            <div className="grid flex-1 grid-cols-4 gap-1.5 overflow-y-auto p-2">
                {loading && (
                    <div className="col-span-4 py-6 text-center text-[13px] text-slate-400">
                        {t('common.loading')}
                    </div>
                )}
                {error && !loading && (
                    <div className="col-span-4 py-6 text-center text-[13px] text-red-500">
                        {error}
                    </div>
                )}
                {!loading && !error && gifs.length === 0 && (
                    <div className="col-span-4 py-6 text-center text-[13px] text-slate-400">
                        {t('gif.no_results')}
                    </div>
                )}
                {!loading && gifs.map((gif) => (
                    <button
                        key={gif.id}
                        type="button"
                        onClick={() => { onSelect(gif.url); onClose(); }}
                        className="cursor-pointer overflow-hidden rounded-lg border-0 bg-slate-50 p-0"
                        title={gif.title}
                    >
                        {gif.preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={gif.preview}
                                alt={gif.title}
                                className="block h-[130px] w-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="flex h-[130px] w-full items-center justify-center bg-slate-200 text-[11px] text-slate-400">
                                {gif.title}
                            </div>
                        )}
                    </button>
                ))}
            </div>
            <div className="border-t border-slate-100 px-2 py-1 text-right">
                <span className="text-[10px] text-slate-400">{t('gif.powered_by')}</span>
            </div>
        </div>
    );
}
