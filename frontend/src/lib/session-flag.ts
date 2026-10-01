// Non-sensitive marker ("a refresh cookie probably exists") so the app only attempts a silent
// token refresh when a session was actually established. The token itself stays memory-only.
const KEY = 'nxt_has_session';

export const hasSessionHint = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage unavailable: fall back to attempting the refresh
  }
};

export const setSessionHint = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};
