'use client';

const FALLBACK_HOSTS = [
    'host.docker.internal',
    '172.17.0.1',
    '127.0.0.1',
    'localhost',
];

function normalizeHttpBase(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
        return '';
    }
    const value =
        trimmed.startsWith('http://') || trimmed.startsWith('https://')
            ? trimmed
            : `http://${trimmed}`;
    try {
        const url = new URL(value);
        url.pathname = '';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/$/, '');
    } catch {
        return '';
    }
}

function buildWsUrl(base: string, token?: string) {
    const url = new URL(base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    if (token) {
        url.searchParams.set('token', token);
    }
    return url.toString();
}

function normalizeWsCandidate(raw: string, token?: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
        return '';
    }
    try {
        if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
            const url = new URL(trimmed);
            if (!url.pathname || url.pathname === '/') {
                url.pathname = '/ws';
            }
            if (token) {
                url.searchParams.set('token', token);
            }
            return url.toString();
        }
    } catch {
        return '';
    }

    const base = normalizeHttpBase(trimmed);
    if (!base) {
        return '';
    }
    return buildWsUrl(base, token);
}

export function getWsUrlCandidates(
    token?: string,
    extraBases?: string[],
) {
    const wsOverride = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? '';
    const backendEnv = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

    const extraCandidates = (extraBases ?? [])
        .flatMap((item) => item.split(','))
        .map((item) => normalizeWsCandidate(item, token))
        .filter(Boolean);

    const envWs = wsOverride
        .split(',')
        .map((item) => normalizeWsCandidate(item, token))
        .filter(Boolean);

    const envHttp = backendEnv
        .split(',')
        .map((item) => normalizeHttpBase(item))
        .filter(Boolean)
        .map((base) => buildWsUrl(base, token));

    const windowCandidate =
        typeof window !== 'undefined'
            ? buildWsUrl(
                  `${window.location.protocol}//${window.location.hostname}:3001`,
                  token,
              )
            : '';

    const fallback = FALLBACK_HOSTS.map((host) =>
        buildWsUrl(`http://${host}:3001`, token),
    );

    const candidates = [
        ...extraCandidates,
        ...envWs,
        ...envHttp,
        windowCandidate,
        ...fallback,
    ].filter(Boolean);

    return Array.from(new Set(candidates));
}
