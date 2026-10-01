'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Truck,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  Loader2,
  Package,
  Building2,
  AlertCircle,
  X,
  Warehouse,
  Check,
  CheckCheck,
  MapPin,
  Calendar,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { formatDate, pluralize } from '@/lib/utils';
import {
  useGetDispatchesQuery,
  useCreateDispatchMutation,
  useUpdateTrackingMutation,
  useMarkDeliveredMutation,
  DispatchListItem,
  DispatchStatusType,
} from '@/features/dispatch/dispatchApi';
import { useGetOrdersQuery, useGetOrderByIdQuery } from '@/features/orders/ordersApi';
import { toast } from '@/components/ui/toast';

import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/ui/data-pagination';
export default function DispatchPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">Loading dispatches...</div>}>
      <DispatchContent />
    </Suspense>
  );
}

function DispatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'ADMIN';

  // Read URL params
  const paramStatus = searchParams.get('status')?.toUpperCase() || 'ALL';

  // State
  const [activeStatus, setActiveStatus] = useState<string>(paramStatus);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [trackingModalItem, setTrackingModalItem] = useState<DispatchListItem | null>(null);
  const [deliveryModalItem, setDeliveryModalItem] = useState<DispatchListItem | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tracking Form
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingNotes, setTrackingNotes] = useState('');

  // Create Dispatch Form States
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [dispatchItemQuantities, setDispatchItemQuantities] = useState<Record<string, number>>({});
  const [createCourier, setCreateCourier] = useState('');
  const [createTracking, setCreateTracking] = useState('');
  const [createNotes, setCreateNotes] = useState('');

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Query dispatches
  const { data: dispatchesResponse, isLoading, isFetching, refetch } = useGetDispatchesQuery({
    page,
    limit,
    status: activeStatus !== 'ALL' ? activeStatus : undefined,
    search: debouncedSearch || undefined,
  });

  // Query orders for Create Dispatch picker (Admin only)
  const { data: ordersResponse } = useGetOrdersQuery(
    { limit: 100 },
    { skip: !isAdmin || !isCreateOpen }
  );

  // Fetch selected order details when picked in Create Dispatch modal
  const { data: selectedOrderData, isLoading: isSelectedOrderLoading } = useGetOrderByIdQuery(
    selectedOrderId,
    { skip: !selectedOrderId }
  );

  // Mutations
  const [createDispatch, { isLoading: isCreating }] = useCreateDispatchMutation();
  const [updateTracking, { isLoading: isUpdatingTracking }] = useUpdateTrackingMutation();
  const [markDelivered, { isLoading: isDelivering }] = useMarkDeliveredMutation();

  const dispatches = dispatchesResponse?.data || [];
  const counts = dispatchesResponse?.counts || {
    all: 0,
    pending: 0,
    inTransit: 0,
    delivered: 0,
    cancelled: 0,
  };
  const meta = dispatchesResponse?.meta || { total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 1 };

  // Status Tab definition
  const statusTabs: { key: string; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: counts.all },
    { key: 'PENDING', label: 'Pending', count: counts.pending },
    { key: 'IN_TRANSIT', label: 'In Transit', count: counts.inTransit },
    { key: 'DELIVERED', label: 'Delivered', count: counts.delivered },
    { key: 'CANCELLED', label: 'Cancelled', count: counts.cancelled },
  ];

  // Eligible orders for dispatch (CONFIRMED, PROCESSING, PARTIALLY_DISPATCHED)
  const eligibleOrders = (ordersResponse?.data || []).filter((o) =>
    ['CONFIRMED', 'PROCESSING', 'PARTIALLY_DISPATCHED'].includes(o.status)
  );

  const filteredEligibleOrders = eligibleOrders.filter((o) => {
    if (!orderSearchQuery) return true;
    const q = orderSearchQuery.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      (o.dealer.businessName && o.dealer.businessName.toLowerCase().includes(q)) ||
      o.dealer.name.toLowerCase().includes(q)
    );
  });

  // Pre-fill remaining quantities when selected order data loads
  useEffect(() => {
    if (selectedOrderData?.data?.items) {
      const initialQtys: Record<string, number> = {};
      selectedOrderData.data.items.forEach((item) => {
        const alreadyDispatched = (item.dispatchItems || [])
          .filter((di) => di.dispatch?.status !== 'CANCELLED')
          .reduce((sum, di) => sum + di.quantity, 0);
        const remaining = Math.max(0, item.quantity - alreadyDispatched);
        initialQtys[item.id] = remaining;
      });
      setDispatchItemQuantities(initialQtys);
    }
  }, [selectedOrderData]);

  // Handle open Tracking modal
  const openTrackingModal = (dsp: DispatchListItem) => {
    setTrackingModalItem(dsp);
    setCourierName(dsp.courierName || '');
    setTrackingNumber(dsp.trackingNumber || '');
    setTrackingNotes(dsp.notes || '');
  };

  // Submit Tracking Update
  const handleSaveTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingModalItem) return;
    if (!trackingNumber.trim() || !courierName.trim()) {
      toast.error('Courier Name and Tracking Number are required.');
      return;
    }

    try {
      await updateTracking({
        id: trackingModalItem.id,
        courierName: courierName.trim(),
        trackingNumber: trackingNumber.trim(),
        notes: trackingNotes.trim() || null,
      }).unwrap();

      setTrackingModalItem(null);
      setFeedbackMsg({
        type: 'success',
        text: `Tracking updated for #${trackingModalItem.dispatchNumber}. Status is now IN TRANSIT.`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to update tracking');
    }
  };

  // Submit Mark Delivered
  const handleConfirmDelivered = async () => {
    if (!deliveryModalItem) return;
    try {
      const res = await markDelivered(deliveryModalItem.id).unwrap();
      setDeliveryModalItem(null);
      setFeedbackMsg({
        type: 'success',
        text: res.data?.orderDelivered
          ? `Dispatch #${deliveryModalItem.dispatchNumber} delivered. All dispatches complete: Order marked DELIVERED!`
          : `Dispatch #${deliveryModalItem.dispatchNumber} marked as DELIVERED.`,
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to mark as delivered');
    }
  };

  // Submit Create Dispatch
  const handleCreateDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderData?.data) {
      toast.error('Please select an order to dispatch');
      return;
    }

    const order = selectedOrderData.data;
    const itemsToDispatch: Array<{
      orderItemId: string;
      productVariantId: string;
      quantity: number;
    }> = [];

    order.items.forEach((item) => {
      const qty = dispatchItemQuantities[item.id] || 0;
      if (qty > 0) {
        itemsToDispatch.push({
          orderItemId: item.id,
          productVariantId: item.productVariantId,
          quantity: qty,
        });
      }
    });

    if (itemsToDispatch.length === 0) {
      toast.error('Please specify a dispatch quantity greater than 0 for at least one item.');
      return;
    }

    try {
      const res = await createDispatch({
        orderId: order.id,
        items: itemsToDispatch,
        courierName: createCourier.trim() || null,
        trackingNumber: createTracking.trim() || null,
        notes: createNotes.trim() || null,
      }).unwrap();

      setIsCreateOpen(false);
      setSelectedOrderId('');
      setCreateCourier('');
      setCreateTracking('');
      setCreateNotes('');
      setDispatchItemQuantities({});
      setFeedbackMsg({
        type: 'success',
        text: `Dispatch #${res.data?.dispatch?.dispatchNumber} created successfully! (Order status: ${res.data?.orderStatus})`,
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to create dispatch');
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: DispatchStatusType) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF4E5] text-[#DD7A01] border border-[#F5C278]">
            <Clock size={10} />
            Pending
          </span>
        );
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE]">
            <Truck size={10} />
            In Transit
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF5EE] text-[#2E844A] border border-[#C3E6CD]">
            <CheckCheck size={10} />
            Delivered
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FDF3F2] text-[#BA0517] border border-[#F8D7DA]">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded border border-[#DDDBDA] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center font-bold">
            <Truck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#181818]">Dispatch</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {counts.all}
              </span>
            </div>
            <p className="text-xs text-[#706E6B]">
              {isAdmin
                ? 'Track shipments, warehouse dispatches, and delivery status'
                : 'Track dispatches and courier tracking for your wholesale orders'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative w-64 sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search DSP#, order#, courier..."
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

          {/* Create Dispatch Button (Admin Only) */}
          {isAdmin && (
            <button
              onClick={() => {
                setSelectedOrderId('');
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold rounded transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Create Dispatch</span>
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

      {/* DISPATCH TABLE CARD */}
      <div className="bg-white rounded-b border border-t-0 border-[#DDDBDA] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={24} className="animate-spin text-[#0176D3]" />
            <p className="text-xs">Loading dispatches...</p>
          </div>
        ) : dispatches.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Truck size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-medium text-slate-600">No dispatches found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {debouncedSearch
                ? `No dispatches match "${debouncedSearch}".`
                : `There are currently no dispatches in ${activeStatus.toLowerCase()} status.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] text-[#706E6B] font-semibold uppercase text-[10px] tracking-wider border-b border-[#DDDBDA]">
                  <th className="py-3 px-3">Dispatch #</th>
                  <th className="py-3 px-3">Order #</th>
                  {isAdmin && <th className="py-3 px-3">Dealer</th>}
                  <th className="py-3 px-3 text-center">Items</th>
                  <th className="py-3 px-3">Warehouse</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Courier & Tracking</th>
                  <th className="py-3 px-3">Dispatched At</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDDBDA]">
                {dispatches.map((dsp) => {
                  const isDelivered = dsp.status === 'DELIVERED';
                  const isCancelled = dsp.status === 'CANCELLED';

                  return (
                    <tr
                      key={dsp.id}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/dispatch/${dsp.id}`)}
                    >
                      {/* Dispatch # */}
                      <td className="py-3 px-3">
                        <Link href={`/dispatch/${dsp.id}`} onClick={(e) => e.stopPropagation()} className="font-mono font-bold text-[#0176D3] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0176D3] rounded-sm">
                          {dsp.dispatchNumber}
                        </Link>
                      </td>

                      {/* Order # */}
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/orders/${dsp.order.id}`}
                          className="font-mono font-semibold text-slate-700 hover:text-[#0176D3] hover:underline"
                        >
                          {dsp.order.orderNumber}
                        </Link>
                      </td>

                      {/* Dealer (Admin view only) */}
                      {isAdmin && (
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#181818]">
                            {dsp.order.dealer.businessName || dsp.order.dealer.name}
                          </div>
                          <div className="text-[11px] text-[#706E6B]">{dsp.order.dealer.name}</div>
                        </td>
                      )}

                      {/* Items Count Badge */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {pluralize(dsp._count?.items ?? 1, "item")}
                        </span>
                      </td>

                      {/* Warehouse */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          <Warehouse size={12} className="text-slate-500" />
                          {dsp.warehouse.code}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">{getStatusBadge(dsp.status)}</td>

                      {/* Courier & Tracking */}
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        {dsp.courierName || dsp.trackingNumber ? (
                          <div>
                            <div className="font-semibold text-slate-800">{dsp.courierName || 'Courier'}</div>
                            {dsp.trackingNumber && (
                              <div className="font-mono text-[11px] text-[#0176D3]">
                                {dsp.trackingNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Dispatched At */}
                      <td className="py-3 px-3 whitespace-nowrap text-[#706E6B]">
                        {dsp.dispatchedAt ? formatDate(dsp.dispatchedAt) : 'Pending'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          {/* Admin: Add / Update Tracking */}
                          {isAdmin && !isDelivered && !isCancelled && (
                            <button
                              onClick={() => openTrackingModal(dsp)}
                              className="px-2 py-1 bg-white border border-[#DDDBDA] hover:border-[#0176D3] text-[#0176D3] rounded text-[11px] font-medium transition-colors"
                              title="Update Tracking Details"
                            >
                              {dsp.trackingNumber ? 'Edit Tracking' : 'Add Tracking'}
                            </button>
                          )}

                          {/* Admin: Mark Delivered */}
                          {isAdmin && !isDelivered && !isCancelled && (
                            <button
                              onClick={() => setDeliveryModalItem(dsp)}
                              className="px-2 py-1 bg-[#2E844A] hover:bg-[#256B3B] text-white rounded text-[11px] font-medium transition-colors"
                              title="Mark Dispatch as Delivered"
                            >
                              Mark Delivered
                            </button>
                          )}

                          {/* View link */}
                          <Link
                            href={`/dispatch/${dsp.id}`}
                            className="p-1 text-slate-400 hover:text-[#0176D3] rounded transition-colors ml-1"
                            title="View Dispatch Details"
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

      {/* CREATE DISPATCH MODAL (560px, Admin Only) */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[580px] max-h-[90vh] flex flex-col overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center font-bold">
                  <Truck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Create Dispatch</h3>
                  <p className="text-[11px] text-[#706E6B]">Fulfill items from warehouse stock</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDispatchSubmit} className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-4">
                {/* STEP 1: SELECT ORDER */}
                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">
                    Step 1: Select Eligible Order <span className="text-[#BA0517]">*</span>
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Filter orders by order# or company..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                    />

                    <select
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] bg-white font-medium"
                    >
                      <option value="">-- Choose an order to dispatch --</option>
                      {filteredEligibleOrders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.orderNumber} &bull; {ord.dealer.businessName || ord.dealer.name} ({ord.status})
                        </option>
                      ))}
                    </select>
                    {filteredEligibleOrders.length === 0 && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded">
                        No orders currently awaiting dispatch (must be CONFIRMED or PROCESSING).
                      </p>
                    )}
                  </div>
                </div>

                {/* STEP 2: SELECT ITEMS & QUANTITIES */}
                {selectedOrderId && (
                  <div className="space-y-2 pt-2 border-t border-[#DDDBDA]">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[#181818]">
                        Step 2: Items to Dispatch
                      </label>
                      {selectedOrderData?.data && (
                        <span className="text-[11px] text-[#0176D3] font-medium">
                          Warehouse: {selectedOrderData.data.warehouse.name} ({selectedOrderData.data.warehouse.code})
                        </span>
                      )}
                    </div>

                    {isSelectedOrderLoading ? (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        <Loader2 size={16} className="animate-spin mx-auto text-[#0176D3] mb-1" />
                        Loading order items...
                      </div>
                    ) : selectedOrderData?.data?.items ? (
                      <div className="border border-[#DDDBDA] rounded overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#F8F9FA] text-[#706E6B] font-semibold text-[10px] uppercase border-b border-[#DDDBDA]">
                              <th className="py-2 px-3">Product</th>
                              <th className="py-2 px-2 text-center">Ordered</th>
                              <th className="py-2 px-2 text-center">Dispatched</th>
                              <th className="py-2 px-2 text-center">Remaining</th>
                              <th className="py-2 px-3 text-right w-24">Dispatch Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#DDDBDA]">
                            {selectedOrderData.data.items.map((item) => {
                              const alreadyDispatched = (item.dispatchItems || [])
                                .filter((di) => di.dispatch?.status !== 'CANCELLED')
                                .reduce((sum, di) => sum + di.quantity, 0);
                              const remaining = Math.max(0, item.quantity - alreadyDispatched);
                              const currentVal = dispatchItemQuantities[item.id] ?? remaining;

                              return (
                                <tr key={item.id} className="hover:bg-slate-50">
                                  <td className="py-2 px-3">
                                    <div className="font-semibold text-slate-900">
                                      {item.productVariant.product.name}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono">
                                      {item.productVariant.sku}
                                    </div>
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-700 font-medium">
                                    {item.quantity}
                                  </td>
                                  <td className="py-2 px-2 text-center text-slate-500">
                                    {alreadyDispatched}
                                  </td>
                                  <td className="py-2 px-2 text-center font-bold text-[#0176D3]">
                                    {remaining}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <input
                                      type="number"
                                      min="0"
                                      max={remaining}
                                      disabled={remaining === 0}
                                      value={currentVal}
                                      onChange={(e) => {
                                        const v = parseInt(e.target.value, 10) || 0;
                                        setDispatchItemQuantities({
                                          ...dispatchItemQuantities,
                                          [item.id]: Math.min(remaining, Math.max(0, v)),
                                        });
                                      }}
                                      className="w-16 px-2 py-1 text-xs border border-[#DDDBDA] rounded text-right font-bold focus:outline-none focus:border-[#0176D3]"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* STEP 3: COURIER & TRACKING DETAILS */}
                {selectedOrderId && (
                  <div className="space-y-3 pt-2 border-t border-[#DDDBDA]">
                    <label className="block text-xs font-semibold text-[#181818]">
                      Step 3: Courier & Tracking (Optional)
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Courier Partner
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Blue Dart, Delhivery, DTDC"
                          value={createCourier}
                          onChange={(e) => setCreateCourier(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Tracking Number / AWB
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. BLU12345678"
                          value={createTracking}
                          onChange={(e) => setCreateTracking(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Dispatch Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Box 1 of 2. Fragile items included."
                        value={createNotes}
                        onChange={(e) => setCreateNotes(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:bg-white text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !selectedOrderId}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
                >
                  {isCreating && <Loader2 size={12} className="animate-spin" />}
                  Create Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / UPDATE TRACKING MODAL (480px, Admin Only) */}
      {trackingModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[460px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#4338CA] flex items-center justify-center font-bold">
                  <Truck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Update Courier Tracking</h3>
                  <p className="text-[11px] font-mono text-[#706E6B]">
                    {trackingModalItem.dispatchNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTrackingModalItem(null)}
                className="text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTracking}>
              <div className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">
                    Courier Partner Name <span className="text-[#BA0517]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    placeholder="e.g. Blue Dart / Delhivery / DTDC"
                    className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">
                    Tracking / AWB Number <span className="text-[#BA0517]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. 123456789012"
                    className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Saving tracking details will update the dispatch status to <strong>IN TRANSIT</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">Notes</label>
                  <input
                    type="text"
                    value={trackingNotes}
                    onChange={(e) => setTrackingNotes(e.target.value)}
                    placeholder="e.g. Estimated delivery in 2 business days"
                    className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                  />
                </div>
              </div>

              <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTrackingModalItem(null)}
                  className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:bg-white text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTracking}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
                >
                  {isUpdatingTracking && <Loader2 size={12} className="animate-spin" />}
                  Save Tracking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARK DELIVERED CONFIRMATION MODAL (480px, Admin Only) */}
      {deliveryModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[460px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EBF5EE] text-[#2E844A] flex items-center justify-center font-bold">
                  <CheckCheck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Confirm Delivery</h3>
                  <p className="text-[11px] font-mono text-[#706E6B]">
                    {deliveryModalItem.dispatchNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeliveryModalItem(null)}
                className="text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="p-3.5 rounded bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {deliveryModalItem.order.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dealer:</span>
                  <span className="font-semibold text-slate-800">
                    {deliveryModalItem.order.dealer.businessName || deliveryModalItem.order.dealer.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Items:</span>
                  <span className="text-slate-800">{pluralize(deliveryModalItem._count?.items ?? 1, "item")}</span>
                </div>
              </div>

              <p className="text-xs text-slate-600">
                Are you sure you want to mark this dispatch as <strong>DELIVERED</strong>? If all dispatches for this order are delivered, the order will automatically transition to <strong>DELIVERED</strong>.
              </p>
            </div>

            <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2">
              <button
                onClick={() => setDeliveryModalItem(null)}
                className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:bg-white text-xs font-medium rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelivered}
                disabled={isDelivering}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2E844A] hover:bg-[#256B3B] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
              >
                {isDelivering && <Loader2 size={12} className="animate-spin" />}
                Confirm Delivery
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
