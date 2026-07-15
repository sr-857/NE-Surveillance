import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch, ApiClientError } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { Button, Card } from '../../components/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const me = await apiFetch<{ id: string; email: string; role: 'ADMIN' | 'ANALYST' | 'VIEWER' }>('/auth/me', {
        headers: { Authorization: `Bearer ${res.accessToken}` },
      });
      setSession(res.accessToken, me);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--bg))] px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm"
      >
        <Card className="p-8">
          <h1 className="mb-1 text-xl font-semibold">Northeast Watch</h1>
          <p className="mb-6 text-sm text-[rgb(var(--text-muted))]">Sign in to your account</p>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-lg border border-[rgb(var(--border))] bg-transparent px-3 py-2 text-sm"
              aria-invalid={!!error}
            />

            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-2 w-full rounded-lg border border-[rgb(var(--border))] bg-transparent px-3 py-2 text-sm"
              aria-invalid={!!error}
            />

            {error && (
              <p role="alert" className="mb-4 text-sm text-severity-severe">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
