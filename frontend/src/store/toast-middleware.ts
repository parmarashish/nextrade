import { isFulfilled, type Middleware } from '@reduxjs/toolkit';
import { toast } from '@/components/ui/toast';

// Mutations that already give their own feedback (navigation, page change, silent bootstrap).
const SILENT = new Set(['addToCart', 'updateCartItem', 'impersonateDealer', 'login', 'logout', 'refresh', 'refreshToken', 'impersonate', 'exitImpersonation', 'markAsRead', 'markAllAsRead', 'markNotificationRead', 'markAllNotificationsRead']);

const humanize = (endpoint: string): string => {
  // createProduct -> "Product created", updateStock -> "Stock updated"
  const m = endpoint.match(/^(create|add|update|edit|delete|remove|set|approve|reject|confirm|cancel|adjust|transfer|mark|record|save)([A-Z].*)?$/);
  const words = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  if (!m) return `${words(endpoint).replace(/^./, (c) => c.toUpperCase())} completed`;
  const verb = m[1];
  const noun = m[2] ? words(m[2]) : '';
  const past: Record<string, string> = {
    create: 'created', add: 'added', update: 'updated', edit: 'updated', delete: 'deleted', remove: 'removed',
    set: 'saved', approve: 'approved', reject: 'rejected', confirm: 'confirmed', cancel: 'cancelled',
    adjust: 'adjusted', transfer: 'transferred', mark: 'updated', record: 'recorded', save: 'saved',
  };
  const label = noun || 'item';
  return `${label.replace(/^./, (c) => c.toUpperCase())} ${past[verb]} successfully`;
};

/** Emits a success toast for every fulfilled RTK Query mutation (errors are surfaced by the caller). */
export const toastMiddleware: Middleware = () => (next) => (action) => {
  if (isFulfilled(action)) {
    const meta = (action as any).meta?.arg;
    if (meta?.type === 'mutation' && !SILENT.has(meta.endpointName)) {
      const serverMessage = (action as any).payload?.message;
      toast.success(
        typeof serverMessage === 'string' && serverMessage.length < 90 ? serverMessage : humanize(meta.endpointName)
      );
    }
  }
  return next(action);
};
