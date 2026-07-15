import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken } from '../lib/jwt';
import { redisSub } from '../lib/redis';
import { logger } from '../lib/logger';
import { ALERTS_CHANNEL } from '../modules/alerts/alerts.service';

interface ClientMeta {
  userId?: string;
  subscribedRegions: Set<string>; // empty set = all regions
}

/**
 * Auth is optional here by design: unauthenticated visitors can still watch
 * the live public alert stream (this is a public-safety dashboard), but an
 * authenticated connection is tagged with the user id for audit/future
 * per-user features (e.g. targeted push for their watchlist regions).
 */
export function attachWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<WebSocket, ClientMeta>();

  wss.on('connection', (ws, req) => {
    const meta: ClientMeta = { subscribedRegions: new Set() };

    const url = new URL(req.url ?? '', 'http://internal');
    const token = url.searchParams.get('token');
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        meta.userId = payload.sub;
      } catch {
        // invalid/expired token on a websocket handshake — connection proceeds unauthenticated
      }
    }

    clients.set(ws, meta);
    logger.debug({ userId: meta.userId, totalClients: clients.size }, 'websocket client connected');

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; regions?: string[] };
        if (msg.type === 'subscribe' && Array.isArray(msg.regions)) {
          meta.subscribedRegions = new Set(msg.regions);
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Malformed message; expected JSON' }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.debug({ totalClients: clients.size }, 'websocket client disconnected');
    });

    ws.send(JSON.stringify({ type: 'connected' }));
  });

  // Heartbeat: terminate dead connections that never responded to a previous ping.
  const HEARTBEAT_MS = 30_000;
  const interval = setInterval(() => {
    for (const ws of clients.keys()) {
      const anyWs = ws as WebSocket & { isAlive?: boolean };
      if (anyWs.isAlive === false) {
        ws.terminate();
        continue;
      }
      anyWs.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);
  wss.on('close', () => clearInterval(interval));
  wss.on('connection', (ws) => {
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    ws.on('pong', () => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    });
  });

  redisSub.subscribe(ALERTS_CHANNEL, (err) => {
    if (err) logger.error({ err }, 'failed to subscribe to alerts pubsub channel');
  });

  redisSub.on('message', (channel, message) => {
    if (channel !== ALERTS_CHANNEL) return;
    let alert: { regionCode: string };
    try {
      alert = JSON.parse(message);
    } catch {
      return;
    }
    const payload = JSON.stringify({ type: 'alert.new', data: JSON.parse(message) });
    for (const [ws, meta] of clients) {
      const wantsIt = meta.subscribedRegions.size === 0 || meta.subscribedRegions.has(alert.regionCode);
      if (wantsIt && ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  });

  return wss;
}
