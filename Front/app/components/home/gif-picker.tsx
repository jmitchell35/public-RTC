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

    // Load featured GIFs on mount
    useEffect(() => {
        fetchGifs('');
    }, []);

    // Close on outside click
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
            style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                height: '33vh',
                background: 'white',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                marginBottom: 8,
            }}
        >
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder={t('gif.search_placeholder')}
                    style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 13,
                        outline: 'none',
                    }}
                />
            </div>
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 8,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 6,
                }}
            >
                {loading && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>
                        {t('common.loading')}
                    </div>
                )}
                {error && !loading && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 24, color: '#ef4444', fontSize: 13 }}>
                        {error}
                    </div>
                )}
                {!loading && !error && gifs.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>
                        {t('gif.no_results')}
                    </div>
                )}
                {!loading && gifs.map((gif) => (
                    <button
                        key={gif.id}
                        type="button"
                        onClick={() => {
                            onSelect(gif.url);
                            onClose();
                        }}
                        style={{
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            borderRadius: 8,
                            overflow: 'hidden',
                            background: '#f8fafc',
                        }}
                        title={gif.title}
                    >
                        {gif.preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={gif.preview}
                                alt={gif.title}
                                style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
                                loading="lazy"
                            />
                        ) : (
                            <div style={{ width: '100%', height: 130, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#94a3b8' }}>
                                {gif.title}
                            </div>
                        )}
                    </button>
                ))}
            </div>
            <div style={{ padding: '4px 8px', borderTop: '1px solid #f1f5f9', textAlign: 'right' }}>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{t('gif.powered_by')}</span>
            </div>
        </div>
    );
}
