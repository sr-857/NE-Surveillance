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
  useEffect(() => {
    // WebSockets were removed for serverless compatibility.
    // Fallback to aggressive 30-second polling to ensure the dashboard remains semi-live.
    const interval = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }, 30000);

    return () => clearInterval(interval);
  }, [queryClient]);
}
