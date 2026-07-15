import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'ANALYST' | 'VIEWER';
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
}

/**
 * Deliberately NOT persisted to localStorage/sessionStorage: an access token
 * sitting in web storage is readable by any injected script (XSS), whereas
 * an in-memory value disappears on tab close/reload. The refresh cookie
 * (httpOnly, Secure, SameSite=Strict — set server-side, see auth.routes.ts)
 * is what survives a reload; `bootstrapSession()` in apiClient.ts calls
 * POST /api/auth/refresh on app start to silently re-establish this state.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
}));
