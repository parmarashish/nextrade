'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Filter,
  X,
  History,
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  Lock,
  Unlock,
  Building,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import {
  useGetStockMovementsQuery,
  StockMovementItem,
} from '@/features/inventory/inventoryApi';
import { useGetWarehousesQuery } from '@/features/inventory/warehousesApi';

import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/ui/data-pagination';
export default function StockMovementsPage() {
  const [warehouseId, setWarehouseId] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  // Queries
  const { data: movementsData, isLoading } = useGetStockMovementsQuery({
    warehouseId: warehouseId || undefined,
    type: type || undefined,
    page,
    limit,
  });

  const { data: warehousesData } = useGetWarehousesQuery();
  const warehouses = warehousesData?.data || [];

  const movements = movementsData?.data || [];
  const meta = movementsData?.meta || { total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 1 };

  const hasFilters = Boolean(warehouseId || type);

  const getTypeBadge = (movementType: string) => {
    switch (movementType) {
      case 'IN':
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-800',
          border: 'border-emerald-200',
          icon: <TrendingUp size={12} className="text-emerald-600" />,
        };
      case 'OUT':
        return {
          bg: 'bg-rose-50',
          text: 'text-rose-800',
          border: 'border-rose-200',
          icon: <TrendingDown size={12} className="text-rose-600" />,
        };
      case 'ADJUSTMENT':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-800',
          border: 'border-blue-200',
          icon: <ArrowRightLeft size={12} className="text-[#0176D3]" />,
        };
      case 'RESERVED':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-800',
          border: 'border-amber-200',
          icon: <Lock size={12} className="text-amber-600" />,
        };
      case 'RELEASED':
      default:
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-200',
          icon: <Unlock size={12} className="text-slate-500" />,
        };
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Breadcrumb ──────────────────────────────────────────────── */}
      <div>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 text-xs text-[#706E6B] hover:text-[#0176D3] font-medium transition-colors mb-2"
        >
          <ArrowLeft size={13} />
          <span>Back to Inventory</span>
        </Link>
      </div>

      {/* ─── Header & Filters ────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#181818] tracking-tight flex items-center gap-2">
            <History size={22} className="text-[#0176D3]" />
            Stock Movement Audit Log{' '}
            <span className="text-sm font-normal text-[#706E6B]">
              ({meta.total} entries)
            </span>
          </h1>
          <p className="text-xs text-[#706E6B] mt-0.5">
            Immutable physical, reserved, transfer, and adjustment movements recorded across all warehouses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Warehouse Filter */}
          <select
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded border border-[#DDDBDA] text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors bg-white shadow-2xs"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} - {wh.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded border border-[#DDDBDA] text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors bg-white shadow-2xs"
          >
            <option value="">All Movement Types</option>
            <option value="IN">IN (Stock Received / Created)</option>
            <option value="OUT">OUT (Dispatches & Transfers)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Audits / Corrections)</option>
            <option value="RESERVED">RESERVED (Order Placed)</option>
            <option value="RELEASED">RELEASED (Order Cancelled)</option>
          </select>

          {hasFilters && (
            <button
              onClick={() => {
                setWarehouseId('');
                setType('');
                setPage(1);
              }}
              className="h-9 px-2.5 rounded border border-slate-300 text-xs text-[#706E6B] hover:text-[#181818] hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              <X size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Movements Table ─────────────────────────────────────────── */}
      <div className="bg-white rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#DDDBDA] bg-slate-50/70 text-[#706E6B] font-semibold">
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3 text-center">Type</th>
                <th className="py-3 px-3">Product & Variant</th>
                <th className="py-3 px-3">Warehouse</th>
                <th className="py-3 px-3 text-center">Qty</th>
                <th className="py-3 px-3">Reference</th>
                <th className="py-3 px-3">Performed By</th>
                <th className="py-3 px-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDDBDA]/60">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-3">
                      <div className="h-3 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-4 bg-slate-100 rounded-full w-14 mx-auto" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3.5 bg-slate-100 rounded w-36 mb-1" />
                      <div className="h-2.5 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-3 bg-slate-100 rounded w-8 mx-auto" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3 bg-slate-100 rounded w-24" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3 bg-slate-100 rounded w-24" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3 bg-slate-100 rounded w-28" />
                    </td>
                  </tr>
                ))
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <History size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-[#706E6B]">No stock movement records found</p>
                  </td>
                </tr>
              ) : (
                movements.map((mov) => {
                  const badge = getTypeBadge(mov.type);

                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date & Time */}
                      <td className="py-2.5 px-3 text-[#706E6B] whitespace-nowrap">
                        {formatDate(mov.createdAt)}{' '}
                        <span className="text-[10px] text-slate-400">
                          {new Date(mov.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {badge.icon}
                          <span>{mov.type}</span>
                        </span>
                      </td>

                      {/* Product & Variant */}
                      <td className="py-2.5 px-3 max-w-[200px]">
                        <span className="font-bold text-[#181818] block truncate">
                          {mov.productVariant?.product?.name || 'Product'}
                        </span>
                        <span className="text-[11px] text-[#706E6B] font-mono block truncate">
                          {mov.productVariant?.name} ({mov.productVariant?.sku})
                        </span>
                      </td>

                      {/* Warehouse */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-[#0176D3] bg-[#EAF5FE] px-1.5 py-0.5 rounded border border-[#D4E7F9]">
                          {mov.warehouse?.code}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="py-2.5 px-3 text-center font-bold">
                        <span
                          className={
                            mov.type === 'OUT' || mov.type === 'RESERVED'
                              ? 'text-[#BA0517]'
                              : 'text-[#2E844A]'
                          }
                        >
                          {mov.type === 'OUT' ? `-${mov.quantity}` : `+${mov.quantity}`}
                        </span>
                      </td>

                      {/* Reference */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#181818]">
                        {mov.referenceId || '—'}
                      </td>

                      {/* Performed By */}
                      <td className="py-2.5 px-3 text-[#444444] truncate max-w-[130px]">
                        {mov.performedBy?.name || 'System Automated'}
                      </td>

                      {/* Notes */}
                      <td className="py-2.5 px-3 text-[#706E6B] text-[11px] max-w-[180px] truncate" title={mov.notes || ''}>
                        {mov.notes || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <DataPagination
          currentPage={page}
          totalPages={meta.totalPages}
          totalItems={meta.total}
          itemsPerPage={limit}
          onPageChange={setPage}
          onItemsPerPageChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
