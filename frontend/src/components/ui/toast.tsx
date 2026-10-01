'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const EVENT = 'nextrade:toast';
let counter = 0;

function emit(kind: ToastKind, message: string) {
  if (typeof window === 'undefined' || !message) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: ++counter, kind, message } }));
}

/** Imperative toast API – callable from components, handlers and store middleware. */
export const toast = {
  success: (message: string) => emit('success', message),
  error: (message: string) => emit('error', message),
  info: (message: string) => emit('info', message),
};

const STYLES: Record<ToastKind, { box: string; icon: React.ReactNode }> = {
  success: { box: 'border-[#2E844A] bg-[#F1FAF3] text-[#194E2B]', icon: <CheckCircle2 size={16} className="text-[#2E844A]" /> },
  error: { box: 'border-[#BA0517] bg-[#FDF3F2] text-[#7A0410]', icon: <AlertCircle size={16} className="text-[#BA0517]" /> },
  info: { box: 'border-[#0176D3] bg-[#EAF5FE] text-[#014486]', icon: <Info size={16} className="text-[#0176D3]" /> },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const item = (e as CustomEvent<ToastItem>).detail;
      setItems((prev) => [...prev.slice(-3), item]);
      window.setTimeout(
        () => setItems((prev) => prev.filter((t) => t.id !== item.id)),
        item.kind === 'error' ? 6000 : 3500
      );
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)] pointer-events-none"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-2.5 rounded border-l-4 border shadow-lg px-3 py-2.5 text-xs font-medium animate-in slide-in-from-right-4 fade-in duration-200',
            STYLES[t.kind].box
          )}
        >
          <span className="mt-0.5 shrink-0">{STYLES[t.kind].icon}</span>
          <span className="flex-1 leading-relaxed">{t.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            className="shrink-0 p-0.5 rounded opacity-60 hover:opacity-100"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
