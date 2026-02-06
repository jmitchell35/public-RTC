'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { getWsUrlCandidates } from '@/lib/ws';
import { parseWsEvent } from '@/lib/ws-events';
import type { WsEvent } from '@/lib/ws-events';

type HomeWsContextValue = {
    addListener: (listener: (event: WsEvent) => void) => () => void;
    send: (payload: { type: string; data?: unknown }) => void;
    isConnected: boolean;
};

const HomeWsContext = createContext<HomeWsContextValue | null>(null);

export function useHomeWs() {
    return useContext(HomeWsContext);
}

type HomeWsProviderProps = {
    children: React.ReactNode;
    wsToken?: string | null;
    wsBaseUrls?: string;
};

export default function HomeWsProvider({
    children,
    wsToken,
    wsBaseUrls,
}: HomeWsProviderProps) {
    const listenersRef = useRef(new Set<(event: WsEvent) => void>());
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const wsBases = useMemo(
        () =>
            wsBaseUrls
                ? wsBaseUrls
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean)
                : [],
        [wsBaseUrls],
    );

    const addListener = useCallback(
        (listener: (event: WsEvent) => void) => {
            listenersRef.current.add(listener);
            return () => {
                listenersRef.current.delete(listener);
            };
        },
        [],
    );

    const send = useCallback((payload: { type: string; data?: unknown }) => {
        const socket = wsRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        socket.send(JSON.stringify(payload));
    }, []);

    useEffect(() => {
        if (!wsToken) {
            return;
        }
        const candidates = getWsUrlCandidates(wsToken ?? undefined, wsBases);
        if (candidates.length === 0) {
            return;
        }

        let active = true;
        let ws: WebSocket | null = null;
        let attempt = 0;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

        const connect = () => {
            if (!active) {
                return;
            }
            const url = candidates[attempt] ?? candidates[0];
            ws = new WebSocket(url);
            let opened = false;

            ws.addEventListener('open', () => {
                opened = true;
                wsRef.current = ws;
                setIsConnected(true);
            });

            ws.addEventListener('message', (event) => {
                if (typeof event.data !== 'string') {
                    return;
                }
                const wsEvent = parseWsEvent(event.data);
                if (!wsEvent) {
                    return;
                }
                listenersRef.current.forEach((listener) => {
                    listener(wsEvent);
                });
            });

            ws.addEventListener('close', () => {
                wsRef.current = null;
                setIsConnected(false);
                if (!active) {
                    return;
                }
                if (!opened && attempt < candidates.length - 1) {
                    attempt += 1;
                    connect();
                    return;
                }
                reconnectTimer = setTimeout(() => {
                    attempt = 0;
                    connect();
                }, 2500);
            });
        };

        connect();

        return () => {
            active = false;
            setIsConnected(false);
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
            }
            if (ws) {
                ws.close();
            }
        };
    }, [wsToken, wsBases]);

    const value = useMemo(
        () => ({
            addListener,
            send,
            isConnected,
        }),
        [addListener, send, isConnected],
    );

    return (
        <HomeWsContext.Provider value={value}>
            {children}
        </HomeWsContext.Provider>
    );
}
