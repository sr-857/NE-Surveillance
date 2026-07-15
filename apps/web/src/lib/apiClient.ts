import { useAuthStore } from '../store/authStore';

// In production, VITE_API_URL points to the deployed API (e.g. https://northeast-watch-api.vercel.app/api).
// In local dev, it defaults to /api (same-origin proxy).
const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions extends RequestInit {
  skipAuthRetry?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

/** POST /api/auth/refresh using the httpOnly cookie; the browser sends it automatically. */
async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string };
        const me = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        });
        if (!me.ok) return false;
        const user = await me.json();
        useAuthStore.getState().setSession(data.accessToken, user);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && !options.skipAuthRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, skipAuthRetry: true });
    }
    useAuthStore.getState().clearSession();
  }

  if (!res.ok) {
    let body: { error?: { code: string; message: string; details?: unknown } } = {};
    try {
      body = await res.json();
    } catch {
      // non-JSON error body — fall through to generic message
    }
    throw new ApiClientError(
      res.status,
      body.error?.code ?? 'UNKNOWN_ERROR',
      body.error?.message ?? `Request failed with status ${res.status}`,
      body.error?.details,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Call once at app boot to silently restore a session from the refresh cookie, if any. */
export async function bootstrapSession(): Promise<void> {
  await tryRefresh();
}
