import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';

/**
 * Subscribes to the live alert push stream. On a new alert, it invalidates
 * the TanStack Query cache for `['alerts']` rather than trying to merge the
 * payload manually — simpler, and guarantees the UI matches a real refetch
 * (correct filters, sort order, region joins) rather than a hand-patched
 * client-side approximation.
 */
export function useLiveAlerts(): void {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(1000);

  useEffect(() => {
    let cancelled = false;

    function connect(): void {
      if (cancelled) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws${accessToken ? `?token=${accessToken}` : ''}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retryDelayRef.current = 1000; // reset backoff on a successful connection
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string };
          if (msg.type === 'alert.new') {
            void queryClient.invalidateQueries({ queryKey: ['alerts'] });
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        // Exponential backoff, capped at 30s, so a server restart doesn't
        // get hammered by every connected client reconnecting simultaneously.
        setTimeout(connect, retryDelayRef.current);
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000);
      };
    }

    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [accessToken, queryClient]);
}
