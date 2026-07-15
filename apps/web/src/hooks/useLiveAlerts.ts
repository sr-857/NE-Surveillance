import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Polls for new alerts every 30 seconds by invalidating the TanStack Query
 * cache. This replaced the WebSocket push stream for serverless compatibility.
 */
export function useLiveAlerts(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    // WebSockets were removed for serverless compatibility.
    // Fallback to aggressive 30-second polling to ensure the dashboard remains semi-live.
    const interval = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }, 30000);

    return () => clearInterval(interval);
  }, [queryClient]);
}
