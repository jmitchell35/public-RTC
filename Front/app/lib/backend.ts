const FALLBACK_URLS = [
    'http://host.docker.internal:3001',
    'http://172.17.0.1:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3001',
];

function normalizeUrl(raw: string) {
    try {
        const value = raw.startsWith('http://') || raw.startsWith('https://')
            ? raw
            : `http://${raw}`;
        const url = new URL(value);
        return url.toString().replace(/\/$/, '');
    } catch {
        return '';
    }
}

function getBackendCandidates() {
    const envValue =
        process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
    const envUrls = envValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map(normalizeUrl)
        .filter(Boolean)
        .filter((value) => {
            try {
                return new URL(value).port !== '3000';
            } catch {
                return true;
            }
        });

    const fallbackUrls = FALLBACK_URLS.map(normalizeUrl).filter(Boolean);
    return Array.from(new Set([...envUrls, ...fallbackUrls]));
}

export async function fetchBackend(
    path: string,
    init: RequestInit,
): Promise<{ response: Response; baseUrl: string }> {
    const candidates = getBackendCandidates();
    let lastError: unknown;

    for (const baseUrl of candidates) {
        try {
            const health = await fetch(`${baseUrl}/health`, {
                method: 'GET',
                cache: 'no-store',
            });
            if (!health.ok) {
                continue;
            }

            const response = await fetch(`${baseUrl}${path}`, init);
            return { response, baseUrl };
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError ?? new Error('Backend unreachable');
}
