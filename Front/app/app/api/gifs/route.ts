import { NextRequest, NextResponse } from 'next/server';

const KLIPY_API_KEY = process.env.KLIPY_API_KEY ?? '';
const KLIPY_BASE = 'https://api.klipy.com/api/v1';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const limit = searchParams.get('limit') ?? '16';

    if (!KLIPY_API_KEY) {
        return NextResponse.json({ error: 'KLIPY_API_KEY not configured' }, { status: 503 });
    }

    const endpoint = q
        ? `${KLIPY_BASE}/${KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(q)}&limit=${limit}`
        : `${KLIPY_BASE}/${KLIPY_API_KEY}/gifs/trending?limit=${limit}`;

    try {
        const res = await fetch(endpoint, { next: { revalidate: 60 } });
        if (!res.ok) {
            return NextResponse.json({ error: 'Klipy API error' }, { status: res.status });
        }
        const data = await res.json();
        const items: any[] = data.data ?? [];
        const results = items.map((item) => ({
            id: item.id,
            title: item.title ?? '',
            url: item.file?.hd?.gif?.url || item.file?.md?.gif?.url || '',
            preview: item.file?.sm?.gif?.url || item.file?.md?.gif?.url || item.file?.hd?.gif?.url || '',
        }));
        return NextResponse.json({ results });
    } catch (error) {
        console.error('Klipy fetch failed', error);
        return NextResponse.json({ error: 'Failed to fetch GIFs' }, { status: 500 });
    }
}
