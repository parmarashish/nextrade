'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText,
  Search,
  Download,
  ExternalLink,
  ChevronRight,
  Loader2,
  Calendar,
  Warehouse,
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  X,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { formatCurrency, formatDate, pluralize } from '@/lib/utils';
import {
  useGetInvoicesQuery,
  useRegenerateInvoiceMutation,
  InvoiceListItem,
  PaymentStatusType,
} from '@/features/invoices/invoicesApi';
import { useGetWarehousesQuery } from '@/features/inventory/warehousesApi';

import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/ui/data-pagination';
export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">Loading invoices...</div>}>
      <InvoicesContent />
    </Suspense>
  );
}

function InvoicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'ADMIN';

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query Warehouses for Filter
  const { data: whResponse } = useGetWarehousesQuery();
  const warehouses = whResponse?.data || [];

  // Query Invoices
  const { data, isLoading, isFetching, refetch } = useGetInvoicesQuery({
    page,
    limit,
    search: debouncedSearch || undefined,
    warehouseId: warehouseId !== 'ALL' ? warehouseId : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const [regenerateInvoice, { isLoading: isRegenerating }] = useRegenerateInvoiceMutation();

  const invoices = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 1 };

  // Toast auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Handle PDF Download
  const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingId(invoiceId);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${baseUrl}/invoices/${invoiceId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to generate invoice PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);

      setToastMessage({ type: 'success', text: `Downloaded ${invoiceNumber}.pdf` });
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Error downloading PDF' });
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Regenerate
  const handleRegenerate = async (orderId: string, invoiceNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await regenerateInvoice(orderId).unwrap();
      setToastMessage({ type: 'success', text: res.message || `Invoice #${invoiceNumber} regenerated` });
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.data?.message || 'Failed to regenerate invoice' });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setWarehouseId('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(searchTerm || warehouseId !== 'ALL' || dateFrom || dateTo);

  // Status Badge Component
  const renderPaymentBadge = (status: PaymentStatusType) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E3F5E9] text-[#2E844A] border border-[#A3E2B5]">
            <CheckCircle className="w-3 h-3" />
            PAID
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAF5FE] text-[#0176D3] border border-[#B0D5FC]">
            <Clock className="w-3 h-3" />
            PARTIALLY PAID
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDE8E8] text-[#BA0517] border border-[#F8B4B4]">
            <XCircle className="w-3 h-3" />
            REJECTED
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3D6] text-[#DD7A01] border border-[#FAD889]">
            <Clock className="w-3 h-3" />
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded shadow-lg text-xs font-medium border animate-in fade-in slide-in-from-bottom-2 ${
            toastMessage.type === 'success'
              ? 'bg-[#E3F5E9] text-[#2E844A] border-[#A3E2B5]'
              : 'bg-[#FDE8E8] text-[#BA0517] border-[#F8B4B4]'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 hover:opacity-75 focus:outline-none"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOP BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded border border-[#DDDBDA] shadow-sm">
        {/* Left: Heading + count */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#181818]">
                Invoices
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {meta.total}
              </span>
            </div>
            <p className="text-[11px] text-[#706E6B]">
              Tax compliant B2B sales invoices and payment tracking
            </p>
          </div>
        </div>

        {/* Right: Search + Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice# or order#..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Warehouse Filter */}
          <div className="relative">
            <select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setPage(1);
              }}
              className="py-1.5 pl-2.5 pr-7 text-xs bg-white border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] appearance-none cursor-pointer"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} - {wh.city}
                </option>
              ))}
            </select>
            <Warehouse className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Date Range: From */}
          <div className="flex items-center gap-1 bg-white border border-[#DDDBDA] rounded px-2 py-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-transparent focus:outline-none text-slate-700 cursor-pointer"
            />
          </div>

          {/* Date Range: To */}
          <div className="flex items-center gap-1 bg-white border border-[#DDDBDA] rounded px-2 py-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="text-xs bg-transparent focus:outline-none text-slate-700 cursor-pointer"
            />
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              title="Clear all filters"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}

          {/* Refetch Button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh list"
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-[#DDDBDA] rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* INVOICES TABLE CONTAINER */}
      <div className="bg-white rounded border border-[#DDDBDA] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#0176D3] mx-auto mb-2" />
            <p className="text-xs text-[#706E6B]">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800 mb-1">
              No invoices found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {hasActiveFilters
                ? 'No invoices match your selected filters. Try broadening your criteria.'
                : 'Invoices are generated automatically once orders are dispatched or delivered.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-xs font-semibold text-[#0176D3] bg-[#EAF5FE] hover:bg-[#D4E7F9] rounded transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8F9FA] border-b border-[#DDDBDA] text-[#706E6B] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Invoice#</th>
                  <th className="py-2.5 px-3">Order#</th>
                  {isAdmin && <th className="py-2.5 px-3">Dealer</th>}
                  <th className="py-2.5 px-3">Warehouse</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Issue Date</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-center">Payment Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDDBDA]">
                {invoices.map((inv) => {
                  // Due date logic
                  const creditDays = inv.creditDaysForOrder ?? 30;
                  const issueTime = new Date(inv.createdAt).getTime();
                  const dueTime = issueTime + creditDays * 24 * 60 * 60 * 1000;
                  const dueDate = new Date(dueTime);
                  const isOverdue =
                    Date.now() > dueTime && inv.paymentStatus !== 'PAID';

                  const isDownloading = downloadingId === inv.id;

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                      className="hover:bg-[#F4F6F9] cursor-pointer transition-colors group"
                    >
                      {/* Invoice# */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#0176D3] shrink-0" />
                          <Link href={`/invoices/${inv.id}`} onClick={(e) => e.stopPropagation()} className="font-mono font-bold text-[#0176D3] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0176D3] rounded-sm">
                          {inv.invoiceNumber}
                        </Link>
                        </div>
                      </td>

                      {/* Order# */}
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/orders/${inv.id}`}
                          className="font-mono text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors"
                        >
                          {inv.orderNumber}
                        </Link>
                      </td>

                      {/* Dealer (Admin Only) */}
                      {isAdmin && (
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800 truncate max-w-[160px]">
                            {inv.dealer.businessName || inv.dealer.name}
                          </div>
                          {inv.dealer.gstNumber && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              GST: {inv.dealer.gstNumber}
                            </div>
                          )}
                        </td>
                      )}

                      {/* Warehouse */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {inv.warehouse.code}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(inv.grandTotal)}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {pluralize(inv._count?.items ?? 0, "item")}
                        </div>
                      </td>

                      {/* Issue Date */}
                      <td className="py-3 px-3 text-slate-600">
                        {formatDate(inv.createdAt)}
                      </td>

                      {/* Due Date (Red if overdue) */}
                      <td className="py-3 px-3">
                        <div
                          className={`flex items-center gap-1 font-medium ${
                            isOverdue
                              ? 'text-[#BA0517] font-semibold'
                              : 'text-slate-600'
                          }`}
                        >
                          {isOverdue && (
                            <AlertCircle className="w-3 h-3 text-[#BA0517] shrink-0" />
                          )}
                          <span>{formatDate(dueDate)}</span>
                        </div>
                        {isOverdue && (
                          <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-[#BA0517] bg-[#FDE8E8] px-1 rounded">
                            Overdue
                          </span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-3 text-center">
                        {renderPaymentBadge(inv.paymentStatus)}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {/* Download PDF (Primary) */}
                          <button
                            onClick={(e) => handleDownloadPdf(inv.id, inv.invoiceNumber, e)}
                            disabled={isDownloading}
                            title="Download PDF Invoice"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#0176D3] text-white hover:bg-[#014486] font-medium transition-colors shadow-xs disabled:opacity-50"
                          >
                            {isDownloading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            <span className="hidden sm:inline">PDF</span>
                          </button>

                          {/* View Order */}
                          <Link
                            href={`/orders/${inv.id}`}
                            title="View Sales Order"
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          {/* Regenerate (Admin Only) */}
                          {isAdmin && (
                            <button
                              onClick={(e) => handleRegenerate(inv.id, inv.invoiceNumber, e)}
                              disabled={isRegenerating}
                              title="Regenerate Invoice Number (Admin)"
                              className="p-1 text-slate-400 hover:text-[#0176D3] hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
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
