'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShoppingBag,
  Search,
  Plus,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Truck,
  CheckCheck,
  AlertCircle,
  X,
  ChevronRight,
  Loader2,
  Calendar,
  Building2,
  CreditCard,
  Check,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { formatCurrency, formatDate, pluralize } from '@/lib/utils';
import {
  useGetOrdersQuery,
  useConfirmOrderMutation,
  useCancelOrderMutation,
  OrderListItem,
  OrderStatusType,
  PaymentStatusType,
} from '@/features/orders/ordersApi';

import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/ui/data-pagination';
export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">Loading orders...</div>}>
      <OrdersContent />
    </Suspense>
  );
}

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'ADMIN';

  // Read URL params
  const paramStatus = searchParams.get('status')?.toUpperCase() || 'ALL';
  const paramDealerId = searchParams.get('dealer') || '';

  // Filter States
  const [activeStatus, setActiveStatus] = useState<string>(paramStatus);
  const [activePaymentStatus, setActivePaymentStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  // Bulk selection state (Admin only)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkConfirming, setIsBulkConfirming] = useState(false);

  // Cancel Modal State
  const [orderToCancel, setOrderToCancel] = useState<OrderListItem | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Keep state synced with URL status if param changes
  useEffect(() => {
    if (paramStatus && paramStatus !== activeStatus) {
      setActiveStatus(paramStatus);
    }
  }, [paramStatus]);

  // Fetch orders
  const { data: ordersResponse, isLoading, isFetching, refetch } = useGetOrdersQuery({
    page,
    limit,
    status: activeStatus !== 'ALL' ? activeStatus : undefined,
    paymentStatus: activePaymentStatus !== 'ALL' ? activePaymentStatus : undefined,
    search: debouncedSearch || undefined,
    dealerId: paramDealerId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  // Mutations
  const [confirmOrder, { isLoading: isConfirming }] = useConfirmOrderMutation();
  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();

  const orders = ordersResponse?.data || [];
  const counts = ordersResponse?.counts || {
    all: 0,
    pending: 0,
    confirmed: 0,
    processing: 0,
    partiallyDispatched: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
  };
  const meta = ordersResponse?.meta || { total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 1 };

  // Status Tab definition
  const statusTabs: { key: string; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: counts.all },
    { key: 'PENDING', label: 'Pending', count: counts.pending },
    { key: 'CONFIRMED', label: 'Confirmed', count: counts.confirmed },
    { key: 'PROCESSING', label: 'Processing', count: counts.processing },
    { key: 'PARTIALLY_DISPATCHED', label: 'Partially Dispatched', count: counts.partiallyDispatched },
    { key: 'DISPATCHED', label: 'Dispatched', count: counts.dispatched },
    { key: 'DELIVERED', label: 'Delivered', count: counts.delivered },
    { key: 'CANCELLED', label: 'Cancelled', count: counts.cancelled },
  ];

  const paymentFilters = [
    { key: 'ALL', label: 'All Payments' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'PARTIALLY_PAID', label: 'Partially Paid' },
    { key: 'PAID', label: 'Paid' },
    { key: 'REJECTED', label: 'Rejected' },
  ];

  // Handle single order confirmation
  const handleConfirmSingle = async (order: OrderListItem) => {
    try {
      await confirmOrder(order.id).unwrap();
      setFeedbackMsg({ type: 'success', text: `Order #${order.orderNumber} confirmed successfully.` });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.data?.message || 'Failed to confirm order' });
    }
  };

  // Handle single order cancellation
  const handleConfirmCancel = async () => {
    if (!orderToCancel) return;
    try {
      await cancelOrder(orderToCancel.id).unwrap();
      setFeedbackMsg({
        type: 'success',
        text: `Order #${orderToCancel.orderNumber} cancelled. Reserved stock released and credit limit restored.`,
      });
      setOrderToCancel(null);
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.data?.message || 'Failed to cancel order' });
    }
  };

  // Bulk selection toggles
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pendingIds = orders.filter((o) => o.status === 'PENDING').map((o) => o.id);
      setSelectedOrderIds(pendingIds);
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleToggleSelect = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  // Bulk confirm
  const handleBulkConfirm = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkConfirming(true);
    let successCount = 0;
    for (const id of selectedOrderIds) {
      try {
        await confirmOrder(id).unwrap();
        successCount++;
      } catch (err) {
        console.error('Failed to confirm order', id, err);
      }
    }
    setIsBulkConfirming(false);
    setSelectedOrderIds([]);
    setFeedbackMsg({
      type: 'success',
      text: `Successfully confirmed ${successCount} of ${selectedOrderIds.length} orders.`,
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Status badge styling helper
  const getStatusBadge = (status: OrderStatusType) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF4E5] text-[#DD7A01] border border-[#F5C278]">
            <Clock size={10} />
            Pending
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF5FE] text-[#0176D3] border border-[#B0D5F8]">
            <CheckCircle size={10} />
            Confirmed
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F3E8FF] text-[#7E22CE] border border-[#DDD6FE]">
            <Package size={10} />
            Processing
          </span>
        );
      case 'PARTIALLY_DISPATCHED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF8E7] text-[#B45309] border border-[#FDE68A]">
            <Truck size={10} />
            Partially Dispatched
          </span>
        );
      case 'DISPATCHED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE]">
            <Truck size={10} />
            Dispatched
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF5EE] text-[#2E844A] border border-[#C3E6CD]">
            <CheckCheck size={10} />
            Delivered
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FDF3F2] text-[#BA0517] border border-[#F8D7DA]">
            <XCircle size={10} />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  // Payment badge helper
  const getPaymentBadge = (status: PaymentStatusType) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#EBF5EE] text-[#2E844A]">
            Paid
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF8E7] text-[#DD7A01]">
            Partially Paid
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FDF3F2] text-[#BA0517]">
            Rejected
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
            Pending
          </span>
        );
    }
  };

  const pendingInCurrentView = orders.filter((o) => o.status === 'PENDING');
  const allPendingSelected =
    pendingInCurrentView.length > 0 &&
    pendingInCurrentView.every((o) => selectedOrderIds.includes(o.id));

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`flex items-center justify-between p-3.5 rounded text-xs font-medium border ${
            feedbackMsg.type === 'success'
              ? 'bg-[#EBF5EE] text-[#2E844A] border-[#C3E6CD]'
              : 'bg-[#FDF3F2] text-[#BA0517] border-[#F8D7DA]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded border border-[#DDDBDA] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center font-bold">
            <ShoppingBag size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#181818]">Orders</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {counts.all}
              </span>
              {paramDealerId && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-[#0176D3] border border-blue-200">
                  Dealer Filtered
                </span>
              )}
            </div>
            <p className="text-xs text-[#706E6B]">
              {isAdmin
                ? 'Manage B2B orders, fulfillments, and status workflows'
                : 'View your order history, tracking, and invoices'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-56 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search order#, company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Date range filters */}
          <div className="flex items-center gap-1 text-xs">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1.5 border border-[#DDDBDA] rounded text-slate-700 bg-white focus:outline-none focus:border-[#0176D3]"
              title="Date From"
            />
            <span className="text-slate-400 text-xs">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1.5 border border-[#DDDBDA] rounded text-slate-700 bg-white focus:outline-none focus:border-[#0176D3]"
              title="Date To"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
                title="Clear Dates"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* New Order Button (Dealer Only) */}
          {!isAdmin && (
            <Link
              href="/products"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold rounded transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={14} />
              <span>New Order</span>
            </Link>
          )}

          {/* Bulk Confirm Button (Admin Only, when items selected) */}
          {isAdmin && selectedOrderIds.length > 0 && (
            <button
              onClick={handleBulkConfirm}
              disabled={isBulkConfirming}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E844A] hover:bg-[#256B3B] text-white text-xs font-semibold rounded transition-colors shadow-sm animate-in fade-in"
            >
              {isBulkConfirming ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              <span>Confirm Selected ({selectedOrderIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* STATUS FILTER TABS */}
      <div className="flex items-center gap-1 border-b border-[#DDDBDA] bg-white px-4 pt-1 rounded-t border-x overflow-x-auto">
        {statusTabs.map((tab) => {
          const isActive = activeStatus === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveStatus(tab.key);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'border-[#0176D3] text-[#0176D3] font-semibold'
                  : 'border-transparent text-[#706E6B] hover:text-[#181818]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  tab.key === 'PENDING' && tab.count > 0
                    ? 'bg-[#FEF3D6] text-[#DD7A01]'
                    : isActive
                    ? 'bg-[#EAF5FE] text-[#0176D3]'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* SECONDARY PAYMENT FILTER BAR */}
      <div className="flex items-center gap-1 px-4 py-2 bg-[#F8F9FA] border-x border-[#DDDBDA] text-xs">
        <span className="text-[#706E6B] text-[11px] font-semibold mr-1 flex items-center gap-1">
          <CreditCard size={12} /> Payment:
        </span>
        {paymentFilters.map((pf) => {
          const isSelected = activePaymentStatus === pf.key;
          return (
            <button
              key={pf.key}
              onClick={() => {
                setActivePaymentStatus(pf.key);
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                isSelected
                  ? 'bg-[#0176D3] text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pf.label}
            </button>
          );
        })}
      </div>

      {/* ORDERS TABLE CARD */}
      <div className="bg-white rounded-b border border-t-0 border-[#DDDBDA] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={24} className="animate-spin text-[#0176D3]" />
            <p className="text-xs">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <ShoppingBag size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-medium text-slate-600">No orders found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {debouncedSearch
                ? `No orders match "${debouncedSearch}".`
                : `There are currently no orders in ${activeStatus.toLowerCase()} status.`}
            </p>
            {!isAdmin && (
              <Link
                href="/products"
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] text-white text-xs font-semibold rounded hover:bg-[#014486] transition-colors"
              >
                <Plus size={14} /> Browse Catalog & Order
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] text-[#706E6B] font-semibold uppercase text-[10px] tracking-wider border-b border-[#DDDBDA]">
                  {isAdmin && (
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={allPendingSelected}
                        onChange={handleSelectAll}
                        disabled={pendingInCurrentView.length === 0}
                        className="rounded border-[#DDDBDA] text-[#0176D3] focus:ring-0"
                        title="Select all Pending orders"
                      />
                    </th>
                  )}
                  <th className="py-3 px-4">Order #</th>
                  {isAdmin && <th className="py-3 px-4">Dealer</th>}
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDDBDA]">
                {orders.map((ord) => {
                  const isSelected = selectedOrderIds.includes(ord.id);
                  const isPending = ord.status === 'PENDING';
                  const isDeliveredOrDispatched =
                    ord.status === 'DISPATCHED' || ord.status === 'DELIVERED';

                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-slate-50 transition-colors group cursor-pointer ${
                        isSelected ? 'bg-blue-50/50' : ''
                      }`}
                      onClick={() => router.push(`/orders/${ord.id}`)}
                    >
                      {/* Checkbox for Admin */}
                      {isAdmin && (
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          {isPending ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(ord.id)}
                              className="rounded border-[#DDDBDA] text-[#0176D3] focus:ring-0"
                            />
                          ) : (
                            <span className="w-4 inline-block" />
                          )}
                        </td>
                      )}

                      {/* Order Number */}
                      <td className="py-3 px-4">
                        <Link href={`/orders/${ord.id}`} onClick={(e) => e.stopPropagation()} className="font-mono font-bold text-[#0176D3] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0176D3] rounded-sm">
                          {ord.orderNumber}
                        </Link>
                        {ord.invoiceNumber && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            INV: {ord.invoiceNumber}
                          </div>
                        )}
                      </td>

                      {/* Dealer (Admin view only) */}
                      {isAdmin && (
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#181818]">
                            {ord.dealer.businessName || ord.dealer.name}
                          </div>
                          <div className="text-[11px] text-[#706E6B]">{ord.dealer.name}</div>
                        </td>
                      )}

                      {/* Items Count Badge */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {pluralize(ord._count?.items ?? 1, "item")}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-[#181818]">
                          {formatCurrency(ord.grandTotal)}
                        </div>
                        {ord.discount > 0 && (
                          <div className="text-[10px] text-[#2E844A]">
                            Disc: -{formatCurrency(ord.discount)}
                          </div>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getPaymentBadge(ord.paymentStatus)}
                      </td>

                      {/* Order Status */}
                      <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(ord.status)}</td>

                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-[#706E6B]">
                        {formatDate(ord.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          {/* Admin: Confirm pending order */}
                          {isAdmin && isPending && (
                            <button
                              onClick={() => handleConfirmSingle(ord)}
                              disabled={isConfirming}
                              className="px-2 py-1 bg-[#2E844A] hover:bg-[#256B3B] text-white rounded text-[11px] font-medium transition-colors"
                              title="Confirm Order"
                            >
                              Confirm
                            </button>
                          )}

                          {/* Admin: Cancel (pending or confirmed) */}
                          {isAdmin && (isPending || ord.status === 'CONFIRMED') && (
                            <button
                              onClick={() => setOrderToCancel(ord)}
                              className="px-2 py-1 bg-white border border-[#DDDBDA] text-slate-600 hover:text-[#BA0517] hover:border-[#BA0517] rounded text-[11px] font-medium transition-colors"
                              title="Cancel Order"
                            >
                              Cancel
                            </button>
                          )}

                          {/* Dealer: Cancel (only when pending) */}
                          {!isAdmin && isPending && (
                            <button
                              onClick={() => setOrderToCancel(ord)}
                              className="px-2 py-1 bg-white border border-[#DDDBDA] text-[#BA0517] hover:bg-[#FDF3F2] rounded text-[11px] font-medium transition-colors"
                              title="Cancel Pending Order"
                            >
                              Cancel
                            </button>
                          )}

                          {/* View Order Link */}
                          <Link
                            href={`/orders/${ord.id}`}
                            className="p-1 text-slate-400 hover:text-[#0176D3] rounded transition-colors ml-1"
                            title="View Order Details"
                          >
                            <ChevronRight size={15} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
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

      {/* CANCEL ORDER CONFIRMATION MODAL */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[460px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FDF3F2] text-[#BA0517] flex items-center justify-center font-bold">
                  <XCircle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Cancel Order</h3>
                  <p className="text-[11px] font-mono text-[#706E6B]">{orderToCancel.orderNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setOrderToCancel(null)}
                className="text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="p-3.5 rounded bg-[#FDF3F2] border border-[#F8D7DA] text-xs text-[#BA0517] space-y-1">
                <p className="font-semibold">
                  Cancel order <span className="font-mono">{orderToCancel.orderNumber}</span>?
                </p>
                <p className="text-slate-700 text-[11px]">
                  Reserved stock will be released immediately and dealer credit limit will be restored by{' '}
                  <span className="font-bold">{formatCurrency(orderToCancel.grandTotal)}</span>.
                </p>
              </div>

              <div className="text-xs text-[#706E6B]">
                This action cannot be undone. Are you sure you want to proceed?
              </div>
            </div>

            <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2">
              <button
                onClick={() => setOrderToCancel(null)}
                className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:bg-white text-xs font-medium rounded transition-colors"
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#BA0517] hover:bg-[#8E0412] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
              >
                {isCancelling && <Loader2 size={12} className="animate-spin" />}
                Yes, Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
