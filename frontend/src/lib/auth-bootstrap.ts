import { hasSessionHint } from './session-flag';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

let inFlight: Promise<string | null> | null = null;

/**
 * Restores the in-memory access token after a page reload using the HttpOnly
 * refresh cookie. De-duplicated so React StrictMode's double effect does not
 * fire two refreshes (the refresh token rotates on every use).
 */
export function bootstrapAccessToken(): Promise<string | null> {
  // Never signed in on this browser: skip the request so the console stays free of expected 401s.
  if (!hasSessionHint()) return Promise.resolve(null);
  if (!inFlight) {
    try {
      // One-time cleanup of the legacy persisted token
      localStorage.removeItem('nxt_token');
    } catch {
      /* ignore */
    }
    inFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => (res.ok ? (await res.json()).data?.accessToken ?? null : null))
      .catch(() => null)
      .finally(() => {
        setTimeout(() => {
          inFlight = null;
        }, 2000);
      });
  }
  return inFlight;
}
