'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import {
  Boxes,
  Search,
  Filter,
  X,
  History,
  ArrowRightLeft,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  Package,
  Loader2,
  AlertCircle,
  Building,
  Info,
  ArrowRight,
} from 'lucide-react';
import { RootState } from '@/store';
import { formatCurrency } from '@/lib/utils';
import {
  useGetInventoryQuery,
  useAdjustStockMutation,
  useTransferStockMutation,
  InventoryItem,
  AdjustStockInput,
  TransferStockInput,
} from '@/features/inventory/inventoryApi';
import { useGetWarehousesQuery } from '@/features/inventory/warehousesApi';
import { useGetCategoryFlatQuery } from '@/features/categories/categoriesApi';

import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/ui/data-pagination';
export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">Loading inventory...</div>}>
      <InventoryContent />
    </Suspense>
  );
}

function InventoryContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');

  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === 'ADMIN';

  // Filters State
  const [warehouseId, setWarehouseId] = useState('');
  const [stockStatus, setStockStatus] = useState<'' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>(
    filterParam === 'low_stock' ? 'LOW_STOCK' : ''
  );
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  // Any filter change returns to the first page
  useEffect(() => {
    setPage(1);
  }, [warehouseId, stockStatus, categoryId, search]);

  // Sync with URL param if user lands on /inventory?filter=low_stock
  useEffect(() => {
    if (filterParam === 'low_stock') {
      setStockStatus('LOW_STOCK');
    }
  }, [filterParam]);

  // Queries
  const { data: inventoryData, isLoading } = useGetInventoryQuery({
    warehouseId: warehouseId || undefined,
    stockStatus: stockStatus || undefined,
    categoryId: categoryId || undefined,
    search: search.trim() || undefined,
    page,
    limit,
  });

  const { data: warehousesData } = useGetWarehousesQuery();
  const warehouses = warehousesData?.data || [];

  const { data: categoriesData } = useGetCategoryFlatQuery({ level: 3 });
  const level3Categories = categoriesData?.data || [];

  const items = inventoryData?.data || [];
  const meta = inventoryData?.meta || { total: 0, totalPages: 1 };

  const hasFilters = Boolean(warehouseId || stockStatus || categoryId || search);

  const handleClearFilters = () => {
    setWarehouseId('');
    setStockStatus('');
    setCategoryId('');
    setSearch('');
    setPage(1);
  };

  // Adjust Stock Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTargetItem, setAdjustTargetItem] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [adjustQty, setAdjustQty] = useState<number | ''>('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Transfer Stock Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromWh, setTransferFromWh] = useState('');
  const [transferToWh, setTransferToWh] = useState('');
  const [transferVariantId, setTransferVariantId] = useState('');
  const [transferQty, setTransferQty] = useState<number | ''>('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  // Mutations
  const [adjustStock, { isLoading: isAdjusting }] = useAdjustStockMutation();
  const [transferStock, { isLoading: isTransferring }] = useTransferStockMutation();

  // Handlers for Adjust Stock
  const handleOpenAdjust = (item?: InventoryItem) => {
    setAdjustTargetItem(item || items[0] || null);
    setAdjustType('IN');
    setAdjustQty('');
    setAdjustNotes('');
    setAdjustError(null);
    setIsAdjustModalOpen(true);
  };

  const handleOpenTransfer = () => {
    setTransferFromWh(warehouses[0]?.id || '');
    setTransferToWh(warehouses[1]?.id || '');
    setTransferVariantId(items[0]?.productVariantId || '');
    setTransferQty('');
    setTransferNotes('');
    setTransferError(null);
    setIsTransferModalOpen(true);
  };

  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);

    if (!adjustTargetItem) {
      setAdjustError('Please select an inventory item to adjust.');
      return;
    }
    if (!adjustQty || Number(adjustQty) <= 0) {
      setAdjustError('Please specify a positive adjustment quantity.');
      return;
    }

    try {
      await adjustStock({
        warehouseId: adjustTargetItem.warehouseId,
        productVariantId: adjustTargetItem.productVariantId,
        quantity: Number(adjustQty),
        type: adjustType,
        notes: adjustNotes.trim() || null,
      }).unwrap();

      setIsAdjustModalOpen(false);
    } catch (err: any) {
      setAdjustError(
        err?.data?.message || err?.message || 'Stock adjustment failed. Check minimum limits.'
      );
    }
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    if (!transferFromWh || !transferToWh) {
      setTransferError('Please select both source and destination warehouses.');
      return;
    }
    if (transferFromWh === transferToWh) {
      setTransferError('Source and destination warehouses cannot be the same.');
      return;
    }
    if (!transferVariantId) {
      setTransferError('Please select a product variant to transfer.');
      return;
    }
    if (!transferQty || Number(transferQty) <= 0) {
      setTransferError('Please specify a positive transfer quantity.');
      return;
    }

    try {
      await transferStock({
        fromWarehouseId: transferFromWh,
        toWarehouseId: transferToWh,
        productVariantId: transferVariantId,
        quantity: Number(transferQty),
        notes: transferNotes.trim() || null,
      }).unwrap();

      setIsTransferModalOpen(false);
    } catch (err: any) {
      setTransferError(
        err?.data?.message || err?.message || 'Stock transfer failed. You cannot transfer more than available.'
      );
    }
  };

  // Preview stock after adjustment
  const previewStock = useMemo(() => {
    if (!adjustTargetItem || !adjustQty || isNaN(Number(adjustQty))) return null;
    const current = adjustTargetItem.physicalQuantity;
    const qty = Number(adjustQty);
    if (adjustType === 'IN') return current + qty;
    if (adjustType === 'OUT') return Math.max(0, current - qty);
    if (adjustType === 'ADJUSTMENT') return qty;
    return current;
  }, [adjustTargetItem, adjustQty, adjustType]);

  // Source available stock for transfer
  const sourceAvailableStock = useMemo(() => {
    if (!transferFromWh || !transferVariantId) return 0;
    const match = items.find(
      (it) => it.warehouseId === transferFromWh && it.productVariantId === transferVariantId
    );
    return match ? match.availableQuantity : 0;
  }, [items, transferFromWh, transferVariantId]);

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Top Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#181818] tracking-tight flex items-center gap-2">
            <Boxes size={24} className="text-[#0176D3]" />
            Warehouse Inventory{' '}
            <span className="text-sm font-normal text-[#706E6B]">
              ({meta.total} records)
            </span>
          </h1>
          <p className="text-xs text-[#706E6B] mt-0.5">
            Physical stock allocation, reserved quantities, and regional fulfillment availability
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/inventory/movements"
            className="h-9 px-3.5 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#181818] transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <History size={14} className="text-[#0176D3]" />
            <span>View Movement History</span>
          </Link>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={handleOpenTransfer}
                className="h-9 px-3.5 rounded border border-[#0176D3] bg-blue-50/60 hover:bg-blue-100 text-[#0176D3] text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <ArrowRightLeft size={14} />
                <span>Transfer Stock</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAdjust()}
                className="h-9 px-4 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <SlidersHorizontal size={14} />
                <span>Adjust Stock</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Filter Row ─────────────────────────────────────────────── */}
      <div className="bg-white p-3.5 rounded border border-[#DDDBDA] shadow-2xs flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#706E6B]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search product or SKU..."
            className="w-full h-8 pl-9 pr-3 rounded border border-[#DDDBDA] text-xs text-[#181818] placeholder-[#A09E9B] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
          />
        </div>

        {/* Warehouse Filter */}
        <select
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setPage(1);
          }}
          className="h-8 px-2.5 rounded border border-[#DDDBDA] text-xs text-[#181818] focus:border-[#0176D3] outline-none bg-white"
        >
          <option value="">All Warehouses</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>
              {wh.code} - {wh.name}
            </option>
          ))}
        </select>

        {/* Stock Status Filter */}
        <select
          value={stockStatus}
          onChange={(e) => {
            setStockStatus(e.target.value as any);
            setPage(1);
          }}
          className="h-8 px-2.5 rounded border border-[#DDDBDA] text-xs text-[#181818] focus:border-[#0176D3] outline-none bg-white"
        >
          <option value="">All Stock Status</option>
          <option value="IN_STOCK">In Stock (Healthy)</option>
          <option value="LOW_STOCK">Low Stock (≤ Reorder)</option>
          <option value="OUT_OF_STOCK">Out of Stock (Zero)</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="h-8 px-2.5 rounded border border-[#DDDBDA] text-xs text-[#181818] focus:border-[#0176D3] outline-none bg-white max-w-[180px]"
        >
          <option value="">All Categories</option>
          {level3Categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            onClick={handleClearFilters}
            className="h-8 px-2 rounded border border-slate-300 text-xs text-[#706E6B] hover:text-[#181818] hover:bg-slate-50 transition-colors flex items-center gap-1"
          >
            <X size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* ─── Inventory Table ─────────────────────────────────────────── */}
      <div className="bg-white rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#DDDBDA] bg-slate-50/70 text-[#706E6B] font-semibold">
                <th className="py-3 px-3">Product</th>
                <th className="py-3 px-3">Variant & SKU</th>
                <th className="py-3 px-3">Warehouse</th>
                <th className="py-3 px-3 text-center">Physical</th>
                <th className="py-3 px-3 text-center">Reserved</th>
                <th className="py-3 px-3 text-center">Available</th>
                <th className="py-3 px-3 text-center">Reorder Pt</th>
                <th className="py-3 px-3 text-center">Status</th>
                {isAdmin && <th className="py-3 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDDBDA]/60">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-3">
                      <div className="h-3.5 bg-slate-100 rounded w-40" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3 bg-slate-100 rounded w-32 mb-1" />
                      <div className="h-2.5 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-3 bg-slate-100 rounded w-10 mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-3 bg-slate-100 rounded w-10 mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-3 bg-slate-100 rounded w-10 mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-3 bg-slate-100 rounded w-10 mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-4 bg-slate-100 rounded-full w-20 mx-auto" />
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-3 text-right">
                        <div className="h-6 bg-slate-100 rounded w-16 ml-auto" />
                      </td>
                    )}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Boxes size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-[#706E6B]">No inventory records found</p>
                    {hasFilters && (
                      <button
                        onClick={handleClearFilters}
                        className="mt-2 text-[11px] text-[#0176D3] hover:underline"
                      >
                        Clear active filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isZero = item.availableQuantity <= 0;
                  const isLow = item.availableQuantity <= item.reorderPoint && !isZero;

                  const availColorClass = isZero
                    ? 'text-[#BA0517]'
                    : isLow
                    ? 'text-[#DD7A01]'
                    : 'text-[#2E844A]';

                  const badgeClass =
                    item.stockStatus === 'IN_STOCK'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : item.stockStatus === 'LOW_STOCK'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Product Name */}
                      <td className="py-2.5 px-3">
                        <Link
                          href={`/products/${item.productVariant?.product?.id}`}
                          className="font-bold text-[#181818] hover:text-[#0176D3] hover:underline block leading-snug"
                        >
                          {item.productVariant?.product?.name || 'Product'}
                        </Link>
                        <span className="text-[10px] text-[#706E6B]">
                          {item.productVariant?.product?.category?.name || 'Category'}
                        </span>
                      </td>

                      {/* Variant & SKU */}
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-[#181818] block">
                          {item.productVariant?.name}
                        </span>
                        <span className="font-mono text-[10px] text-[#706E6B] block">
                          {item.productVariant?.sku}
                        </span>
                      </td>

                      {/* Warehouse Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-[#0176D3] bg-[#EAF5FE] px-1.5 py-0.5 rounded border border-[#D4E7F9]">
                          {item.warehouse?.code}
                        </span>
                      </td>

                      {/* Physical Stock */}
                      <td className="py-2.5 px-3 text-center text-[#181818] font-medium">
                        {item.physicalQuantity}
                      </td>

                      {/* Reserved Quantity */}
                      <td className="py-2.5 px-3 text-center text-[#706E6B]">
                        {item.reservedQuantity > 0 ? (
                          <span className="font-semibold text-amber-700">
                            {item.reservedQuantity}
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>

                      {/* Available Quantity */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-bold inline-flex items-center gap-1 ${availColorClass}`}>
                          {(isLow || isZero) && <AlertTriangle size={12} className="shrink-0" />}
                          {item.availableQuantity}
                        </span>
                      </td>

                      {/* Reorder Point */}
                      <td className="py-2.5 px-3 text-center text-[#706E6B]">
                        {item.reorderPoint}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                        >
                          {item.stockStatus.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      {isAdmin && (
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjust(item)}
                            className="h-7 px-2.5 rounded border border-[#DDDBDA] hover:bg-slate-50 text-[11px] font-semibold text-[#0176D3] transition-colors"
                          >
                            Adjust
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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

      {/* ─── STOCK ADJUSTMENT MODAL (480px) ─────────────────────────── */}
      {isAdjustModalOpen && adjustTargetItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#DDDBDA] shadow-xl max-w-[480px] w-full p-5 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDDBDA] mb-4">
              <h3 className="text-base font-bold text-[#181818] flex items-center gap-1.5">
                <SlidersHorizontal size={16} className="text-[#0176D3]" />
                Stock Adjustment
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 rounded text-[#706E6B] hover:text-[#181818] hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {adjustError && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-[#BA0517] flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAdjust} className="space-y-4">
              {/* Target Item Display (Read-Only) */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#181818]">
                    {adjustTargetItem.productVariant?.product?.name}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#0176D3]">
                    {adjustTargetItem.warehouse?.code}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#706E6B]">
                  <span>{adjustTargetItem.productVariant?.name} ({adjustTargetItem.productVariant?.sku})</span>
                  <span>Physical: <strong>{adjustTargetItem.physicalQuantity} units</strong></span>
                </div>
              </div>

              {/* Adjustment Type Radio Options */}
              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-2">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={`flex flex-col p-2.5 rounded border cursor-pointer text-center transition-colors ${
                      adjustType === 'IN'
                        ? 'border-[#0176D3] bg-blue-50/50'
                        : 'border-[#DDDBDA] hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="adjustType"
                      value="IN"
                      checked={adjustType === 'IN'}
                      onChange={() => setAdjustType('IN')}
                      className="sr-only"
                    />
                    <span className="text-xs font-bold text-[#2E844A]">IN (+ Add)</span>
                    <span className="text-[10px] text-[#706E6B] mt-0.5">Receive stock</span>
                  </label>

                  <label
                    className={`flex flex-col p-2.5 rounded border cursor-pointer text-center transition-colors ${
                      adjustType === 'OUT'
                        ? 'border-[#0176D3] bg-blue-50/50'
                        : 'border-[#DDDBDA] hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="adjustType"
                      value="OUT"
                      checked={adjustType === 'OUT'}
                      onChange={() => setAdjustType('OUT')}
                      className="sr-only"
                    />
                    <span className="text-xs font-bold text-[#BA0517]">OUT (- Deduct)</span>
                    <span className="text-[10px] text-[#706E6B] mt-0.5">Scrap / Loss</span>
                  </label>

                  <label
                    className={`flex flex-col p-2.5 rounded border cursor-pointer text-center transition-colors ${
                      adjustType === 'ADJUSTMENT'
                        ? 'border-[#0176D3] bg-blue-50/50'
                        : 'border-[#DDDBDA] hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="adjustType"
                      value="ADJUSTMENT"
                      checked={adjustType === 'ADJUSTMENT'}
                      onChange={() => setAdjustType('ADJUSTMENT')}
                      className="sr-only"
                    />
                    <span className="text-xs font-bold text-[#0176D3]">CORRECTION</span>
                    <span className="text-[10px] text-[#706E6B] mt-0.5">Set exact qty</span>
                  </label>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                  Adjustment Quantity <span className="text-[#BA0517]">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="e.g. 10"
                  className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                />
              </div>

              {/* Live Preview */}
              {previewStock !== null && (
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-[#706E6B]">Current: {adjustTargetItem.physicalQuantity} units</span>
                  <span className="font-bold text-[#0176D3]">
                    After adjustment: {previewStock} units
                  </span>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                  Reason / Audit Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Inventory count reconciliation, supplier shipment received..."
                  className="w-full rounded border border-[#DDDBDA] p-2.5 text-xs text-[#181818] focus:border-[#0176D3] outline-none transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-[#DDDBDA] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="h-8 px-3 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#444444] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className="h-8 px-4 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isAdjusting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Confirm Adjustment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── STOCK TRANSFER MODAL (480px) ───────────────────────────── */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#DDDBDA] shadow-xl max-w-[480px] w-full p-5 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDDBDA] mb-4">
              <h3 className="text-base font-bold text-[#181818] flex items-center gap-1.5">
                <ArrowRightLeft size={16} className="text-[#0176D3]" />
                Inter-Warehouse Stock Transfer
              </h3>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded text-[#706E6B] hover:text-[#181818] hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {transferError && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-[#BA0517] flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{transferError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitTransfer} className="space-y-4">
              {/* Source & Destination Warehouses */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    From Warehouse <span className="text-[#BA0517]">*</span>
                  </label>
                  <select
                    required
                    value={transferFromWh}
                    onChange={(e) => setTransferFromWh(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-[#DDDBDA] text-xs text-[#181818] focus:border-[#0176D3] outline-none bg-white"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.code} - {wh.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    To Warehouse <span className="text-[#BA0517]">*</span>
                  </label>
                  <select
                    required
                    value={transferToWh}
                    onChange={(e) => setTransferToWh(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-[#DDDBDA] text-xs text-[#181818] focus:border-[#0176D3] outline-none bg-white"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id} disabled={wh.id === transferFromWh}>
                        {wh.code} - {wh.city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Variant Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                  Select Product Variant <span className="text-[#BA0517]">*</span>
                </label>
                <select
                  required
                  value={transferVariantId}
                  onChange={(e) => setTransferVariantId(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-[#DDDBDA] text-xs text-[#181818] focus:border-[#0176D3] outline-none bg-white"
                >
                  {items.map((it) => (
                    <option key={it.productVariantId} value={it.productVariantId}>
                      {it.productVariant?.product?.name} - {it.productVariant?.name} ({it.productVariant?.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Available in Source */}
              <div className="p-2.5 bg-blue-50/60 rounded border border-blue-200/70 flex items-center justify-between text-xs">
                <span className="text-[#014486]">Available in source warehouse:</span>
                <span className="font-bold text-[#0176D3]">{sourceAvailableStock} units</span>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                  Transfer Quantity <span className="text-[#BA0517]">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={sourceAvailableStock || undefined}
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder={`Max ${sourceAvailableStock}`}
                  className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] outline-none transition-colors"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                  Transfer Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Rebalance regional hub inventory ahead of seasonal demand..."
                  className="w-full rounded border border-[#DDDBDA] p-2.5 text-xs text-[#181818] focus:border-[#0176D3] outline-none transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-[#DDDBDA] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="h-8 px-3 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#444444] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTransferring || sourceAvailableStock === 0}
                  className="h-8 px-4 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isTransferring ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Transferring...</span>
                    </>
                  ) : (
                    <span>Execute Transfer</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
