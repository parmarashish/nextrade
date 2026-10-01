import React from 'react';
import { Info } from 'lucide-react';

/** Small ℹ icon with a hover/focus tooltip (pure CSS, keyboard accessible). */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group normal-case tracking-normal align-middle">
      <button
        type="button"
        aria-label={text}
        className="text-[#A09E9B] hover:text-[#0176D3] focus:text-[#0176D3] focus:outline-none rounded-full"
      >
        <Info size={13} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-30 w-56 rounded bg-[#181818] px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
      >
        {text}
      </span>
    </span>
  );
}
