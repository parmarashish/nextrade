import type { Middleware } from '@reduxjs/toolkit';
import { setSessionHint } from '@/lib/session-flag';

/** Keeps the session hint in sync with auth state changes. */
export const sessionHintMiddleware: Middleware = () => (next) => (action) => {
  const type = (action as { type?: string }).type;
  if (type === 'auth/setCredentials' || type === 'auth/updateToken') setSessionHint(true);
  else if (type === 'auth/logout') setSessionHint(false);
  return next(action);
};
