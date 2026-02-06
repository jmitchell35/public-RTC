import fs from 'node:fs';

const FALLBACK_URLS_DOCKER = [
    'http://host.docker.internal:3001',
    'http://172.17.0.1:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3001',
];
const FALLBACK_URLS_LOCAL = [
    'http://127.0.0.1:3001',
    'http://localhost:3001',
    'http://host.docker.internal:3001',
    'http://172.17.0.1:3001',
];

let cachedBaseUrl: string | null = null;

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

function isDockerRuntime() {
    if (process.env.DOCKER || process.env.CONTAINER) {
        return true;
    }
    if (fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv')) {
        return true;
    }
    try {
        return fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
    } catch {
        return false;
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

    const fallbackUrls = (isDockerRuntime()
        ? FALLBACK_URLS_DOCKER
        : FALLBACK_URLS_LOCAL)
        .map(normalizeUrl)
        .filter(Boolean);
    const candidates = [
        ...(wslHost ? [wslHost] : []),
        ...envUrls,
        ...fallbackUrls,
    ];
    return Array.from(new Set(candidates));
}

export async function fetchBackend(
    path: string,
    init: RequestInit,
): Promise<{ response: Response; baseUrl: string }> {
    const candidates = getBackendCandidates();
    let lastError: unknown;

    if (cachedBaseUrl && candidates.includes(cachedBaseUrl)) {
        try {
            const response = await fetch(`${cachedBaseUrl}${path}`, init);
            return { response, baseUrl: cachedBaseUrl };
        } catch (error) {
            cachedBaseUrl = null;
            lastError = error;
        }
    }

    for (const baseUrl of candidates) {
        try {
            const response = await fetch(`${baseUrl}${path}`, init);
            cachedBaseUrl = baseUrl;
            return { response, baseUrl };
        } catch (error) {
            lastError = error;
        }
    }

    console.error('Backend candidates tried:', candidates);
    throw lastError ?? new Error('Backend unreachable');
}
