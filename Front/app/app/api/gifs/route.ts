import { NextRequest, NextResponse } from 'next/server';

const TENOR_API_KEY = process.env.TENOR_API_KEY ?? '';
const TENOR_BASE = 'https://tenor.googleapis.com/v2';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const limit = searchParams.get('limit') ?? '16';

    if (!TENOR_API_KEY) {
        return NextResponse.json({ error: 'TENOR_API_KEY not configured' }, { status: 503 });
    }

    const endpoint = q
        ? `${TENOR_BASE}/search?q=${encodeURIComponent(q)}&key=${TENOR_API_KEY}&limit=${limit}&media_filter=gif`
        : `${TENOR_BASE}/featured?key=${TENOR_API_KEY}&limit=${limit}&media_filter=gif`;

    try {
        const res = await fetch(endpoint, { next: { revalidate: 60 } });
        if (!res.ok) {
            return NextResponse.json({ error: 'Tenor API error' }, { status: res.status });
        }
        const data = await res.json();
        const results = (data.results ?? []).map((item: any) => ({
            id: item.id,
            title: item.title,
            url: item.media_formats?.gif?.url ?? item.url,
            preview: item.media_formats?.tinygif?.url ?? item.media_formats?.gif?.url,
        }));
        return NextResponse.json({ results });
    } catch (error) {
        console.error('Tenor fetch failed', error);
        return NextResponse.json({ error: 'Failed to fetch GIFs' }, { status: 500 });
    }
}
