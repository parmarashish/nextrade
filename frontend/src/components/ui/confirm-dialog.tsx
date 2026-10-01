'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}
interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

const EVENT = 'nextrade:confirm';

/** Promise-based replacement for window.confirm: `if (!(await confirmDialog({...}))) return;` */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<Pending>(EVENT, { detail: { ...options, resolve } }));
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => setPending((e as CustomEvent<Pending>).detail);
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  if (!pending) return null;
  const close = (ok: boolean) => {
    pending.resolve(ok);
    setPending(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="bg-white rounded border border-[#DDDBDA] shadow-xl max-w-[420px] w-full p-5">
        <div className="flex gap-3">
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
              pending.destructive ? 'bg-[#FDF3F2] text-[#BA0517]' : 'bg-[#EAF5FE] text-[#0176D3]'
            )}
          >
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 id="confirm-title" className="text-base font-bold text-[#181818]">
              {pending.title || 'Are you sure?'}
            </h3>
            <p className="text-sm text-[#706E6B] mt-1">{pending.message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={() => close(false)}
            className="h-9 px-4 text-sm font-medium border border-[#DDDBDA] rounded hover:bg-slate-50"
          >
            {pending.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={cn(
              'h-9 px-4 text-sm font-medium text-white rounded',
              pending.destructive ? 'bg-[#BA0517] hover:bg-[#8E0412]' : 'bg-[#0176D3] hover:bg-[#014486]'
            )}
          >
            {pending.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
