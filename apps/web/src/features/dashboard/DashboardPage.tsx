import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWeather, useAlerts, useAcknowledgeAlert, useRegions } from '../../lib/queries';
import { useLiveAlerts } from '../../hooks/useLiveAlerts';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Card, Button, SeverityBadge } from '../../components/ui';
import { RegionMap } from './RegionMap';

export function DashboardPage() {
  useLiveAlerts(); // subscribes to the WS push stream and invalidates the alerts query on new events

  const [selectedRegion, setSelectedRegion] = useState<string | undefined>();
  const { data: regions } = useRegions();
  const { data: weather, isLoading: weatherLoading } = useWeather();
  const { data: alerts, isLoading: alertsLoading } = useAlerts({ regionCode: selectedRegion, activeOnly: true });
  const acknowledge = useAcknowledgeAlert();

  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);

  const canAcknowledge = user?.role === 'ADMIN' || user?.role === 'ANALYST';

  return (
    <div className="flex h-screen flex-col bg-[rgb(var(--bg))]">
      <header className="flex items-center justify-between border-b border-[rgb(var(--border))] px-6 py-3">
        <div>
          <h1 className="text-base font-semibold">Northeast Watch</h1>
          <p className="text-xs text-[rgb(var(--text-muted))]">Situational awareness — Northeast India</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={toggleTheme} aria-label="Toggle dark mode">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </Button>
          {user && (
            <span className="text-xs text-[rgb(var(--text-muted))]">
              {user.email} · {user.role}
            </span>
          )}
          <Button variant="secondary" onClick={clearSession}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_360px]">
        <div className="grid grid-rows-[1fr_auto] gap-4 overflow-hidden">
          <Card className="overflow-hidden p-1">
            {regions ? (
              <RegionMap regions={regions} alerts={alerts ?? []} onSelectRegion={setSelectedRegion} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[rgb(var(--text-muted))]">
                Loading map…
              </div>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3 overflow-x-auto sm:grid-cols-4">
            {weatherLoading && <p className="col-span-4 text-sm text-[rgb(var(--text-muted))]">Loading weather…</p>}
            {weather
              ?.filter((w) => !selectedRegion || w.regionCode === selectedRegion)
              .map((w) => (
                <Card key={w.regionCode} className="p-3">
                  <div className="text-xs font-medium text-[rgb(var(--text-muted))]">{w.regionCode}</div>
                  <div className="text-lg font-semibold">{w.temperatureC.toFixed(1)}°C</div>
                  <div className="text-xs text-[rgb(var(--text-muted))]">
                    {w.dailyPrecipMm[0]?.toFixed(1) ?? '—'}mm rain today
                  </div>
                </Card>
              ))}
          </div>
        </div>

        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3">
            <h2 className="text-sm font-semibold">
              Active Alerts {selectedRegion ? `— ${selectedRegion}` : ''}
            </h2>
            {selectedRegion && (
              <Button variant="ghost" onClick={() => setSelectedRegion(undefined)}>
                Clear filter
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {alertsLoading && <p className="text-sm text-[rgb(var(--text-muted))]">Loading alerts…</p>}
            {!alertsLoading && alerts?.length === 0 && (
              <p className="text-sm text-[rgb(var(--text-muted))]">No active alerts for this filter.</p>
            )}
            <AnimatePresence initial={false}>
              {alerts?.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2 rounded-lg border border-[rgb(var(--border))] p-3"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-[10px] text-[rgb(var(--text-muted))]">
                      {new Date(alert.effectiveAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium">{alert.title}</h3>
                  <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">{alert.description}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-[rgb(var(--text-muted))]">
                    <span>
                      Source: {alert.sourceName}
                      {alert.sourceType === 'MANUAL_ENTRY' ? ' (manual entry)' : ''}
                    </span>
                    {alert.sourceUrl && (
                      <a href={alert.sourceUrl} target="_blank" rel="noreferrer" className="text-brand-500 underline">
                        Source bulletin
                      </a>
                    )}
                  </div>
                  {canAcknowledge && (
                    <Button
                      variant="secondary"
                      className="mt-2 w-full"
                      onClick={() => acknowledge.mutate({ alertId: alert.id })}
                      disabled={acknowledge.isPending}
                    >
                      Acknowledge
                    </Button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>
      </div>
    </div>
  );
}
