import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, GameState, ServerMessage, TeamId } from '../game/types.ts';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

interface UseGameSocketOptions {
  role: 'host' | 'player';
  teamId?: TeamId;
}

export function useGameSocket({ role, teamId }: UseGameSocketOptions) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleRef = useRef(role);
  const teamIdRef = useRef(teamId);
  roleRef.current = role;
  teamIdRef.current = teamId;

  const send = useCallback((message: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    // Hydrate quickly via HTTP before WS finishes handshake
    let cancelled = false;
    fetch('/api/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: GameState | null) => {
        if (!cancelled && data) {
          setGameState(data);
          setClockOffsetMs(data.serverTime - Date.now());
        }
      })
      .catch(() => {
        // WS will hydrate on connect
      });

    let retryAttempt = 0;

    function connect() {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        retryAttempt = 0;
        setConnectionStatus('connected');
        setLastError(null);
        ws.send(
          JSON.stringify({
            type: 'client:register',
            role: roleRef.current,
            teamId: teamIdRef.current,
          } satisfies ClientMessage),
        );
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as ServerMessage;
          if (parsed.type === 'state:sync') {
            setGameState(parsed.state);
            setClockOffsetMs(parsed.state.serverTime - Date.now());
          } else if (parsed.type === 'error') {
            setLastError(parsed.message);
          }
        } catch {
          // Ignore malformed payloads
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnectionStatus('reconnecting');
        const delay = Math.min(4000, 400 * Math.pow(1.6, retryAttempt));
        retryAttempt += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Re-register if role or teamId changes while connected
  useEffect(() => {
    send({
      type: 'client:register',
      role,
      teamId,
    });
  }, [role, teamId, send]);

  return {
    gameState,
    connectionStatus,
    clockOffsetMs,
    lastError,
    clearError: () => setLastError(null),
    send,
  };
}
