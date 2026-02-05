import fs from 'node:fs';

const FALLBACK_URLS = [
    'http://host.docker.internal:3001',
    'http://172.17.0.1:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3001',
];

function getWslHostUrl() {
    const isWsl =
        Boolean(process.env.WSL_DISTRO_NAME) ||
        (fs.existsSync('/proc/version') &&
            fs
                .readFileSync('/proc/version', 'utf8')
                .toLowerCase()
                .includes('microsoft'));
    if (!isWsl) {
        return '';
    }

    try {
        const content = fs.readFileSync('/etc/resolv.conf', 'utf8');
        const match = content.match(/^nameserver\s+([0-9.]+)/m);
        if (!match) {
            return '';
        }
        return `http://${match[1]}:3001`;
    } catch {
        return '';
    }
}

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
    const wslHost = normalizeUrl(getWslHostUrl());
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
    const candidates = wslHost
        ? [wslHost, ...envUrls, ...fallbackUrls]
        : [...envUrls, ...fallbackUrls];
    return Array.from(new Set(candidates));
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

    console.error('Backend candidates tried:', candidates);
    throw lastError ?? new Error('Backend unreachable');
}
