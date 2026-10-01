'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DataPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (limit: number) => void;
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50];
export const DEFAULT_PAGE_SIZE = 10;

/** Up to 5 page numbers around the current page, with ellipses and first/last anchors. */
function getPageItems(current: number, total: number): (number | 'ellipsis-l' | 'ellipsis-r')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 'ellipsis-r', total];
  if (current >= total - 2) return [1, 'ellipsis-l', total - 2, total - 1, total];
  return [1, 'ellipsis-l', current, 'ellipsis-r', total];
}

export function DataPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: DataPaginationProps) {
  if (totalItems === 0) return null;

  const from = (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, totalItems);
  const showPages = totalPages > 1;
  // Nothing to paginate or resize when everything already fits the smallest page size.
  const canResize = totalItems > PAGE_SIZE_OPTIONS[0];

  const btn =
    'h-8 min-w-8 px-2 rounded-sm border text-[13px] font-medium inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="min-h-12 px-4 py-2 bg-white border-t border-[#DDDBDA] flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#706E6B]">
      <span>
        Showing <strong className="text-[#181818] font-semibold">{from}–{to}</strong> of{' '}
        <strong className="text-[#181818] font-semibold">{totalItems}</strong> results
      </span>

      {showPages && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            type="button"
            className={cn(btn, 'border-[#DDDBDA] bg-white text-[#444444] hover:bg-slate-50')}
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          {getPageItems(currentPage, totalPages).map((item) =>
            typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                aria-current={item === currentPage ? 'page' : undefined}
                onClick={() => onPageChange(item)}
                className={cn(
                  btn,
                  'w-8',
                  item === currentPage
                    ? 'bg-[#0176D3] border-[#0176D3] text-white'
                    : 'bg-white border-[#DDDBDA] text-[#444444] hover:bg-slate-50'
                )}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="w-6 text-center select-none">
                …
              </span>
            )
          )}
          <button
            type="button"
            className={cn(btn, 'border-[#DDDBDA] bg-white text-[#444444] hover:bg-slate-50')}
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next <ChevronRight size={14} />
          </button>
        </nav>
      )}

      {canResize && (
        <label className="flex items-center gap-2">
          Rows per page:
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="h-8 px-2 border border-[#DDDBDA] rounded-sm bg-white text-[13px] text-[#181818] focus:outline-none focus:border-[#0176D3]"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
