'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  CheckCheck,
  Building2,
  Calendar,
  ExternalLink,
  Loader2,
  AlertCircle,
  X,
  Warehouse,
  Boxes,
  MapPin,
  FileText,
  Check,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { formatCurrency, formatDate, pluralize } from '@/lib/utils';
import {
  useGetDispatchByIdQuery,
  useUpdateTrackingMutation,
  useMarkDeliveredMutation,
  DispatchStatusType,
} from '@/features/dispatch/dispatchApi';
import { toast } from '@/components/ui/toast';

export default function DispatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dispatchId = params.id as string;
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'ADMIN';

  const { data: dispatchData, isLoading, isError, refetch } = useGetDispatchByIdQuery(dispatchId);
  const [updateTracking, { isLoading: isUpdatingTracking }] = useUpdateTrackingMutation();
  const [markDelivered, { isLoading: isDelivering }] = useMarkDeliveredMutation();

  // Modals state
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [isDeliveredModalOpen, setIsDeliveredModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tracking Form
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingNotes, setTrackingNotes] = useState('');

  const dispatch = dispatchData?.data;

  // Open Tracking Modal
  const openTrackingModal = () => {
    if (!dispatch) return;
    setCourierName(dispatch.courierName || '');
    setTrackingNumber(dispatch.trackingNumber || '');
    setTrackingNotes(dispatch.notes || '');
    setIsTrackingOpen(true);
  };

  // Submit Tracking Update
  const handleSaveTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatch) return;
    if (!courierName.trim() || !trackingNumber.trim()) {
      toast.error('Courier Name and Tracking Number are required.');
      return;
    }

    try {
      await updateTracking({
        id: dispatch.id,
        courierName: courierName.trim(),
        trackingNumber: trackingNumber.trim(),
        notes: trackingNotes.trim() || null,
      }).unwrap();

      setIsTrackingOpen(false);
      setFeedbackMsg({
        type: 'success',
        text: 'Tracking information updated successfully. Status is now IN TRANSIT.',
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to update tracking');
    }
  };

  // Submit Mark Delivered
  const handleConfirmDelivered = async () => {
    if (!dispatch) return;
    try {
      const res = await markDelivered(dispatch.id).unwrap();
      setIsDeliveredModalOpen(false);
      setFeedbackMsg({
        type: 'success',
        text: res.data?.orderDelivered
          ? `Dispatch #${dispatch.dispatchNumber} delivered. All dispatches complete: Order marked DELIVERED!`
          : `Dispatch #${dispatch.dispatchNumber} marked as DELIVERED.`,
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to mark as delivered');
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Loader2 size={24} className="animate-spin text-[#0176D3]" />
        <p className="text-xs">Loading dispatch details...</p>
      </div>
    );
  }

  if (isError || !dispatch) {
    return (
      <div className="bg-white rounded border border-[#DDDBDA] p-12 text-center space-y-3">
        <AlertCircle size={40} className="mx-auto text-[#BA0517]" />
        <h2 className="text-base font-bold text-[#181818]">Dispatch Not Found</h2>
        <p className="text-xs text-[#706E6B]">The dispatch does not exist or you do not have permission.</p>
        <Link
          href="/dispatch"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] text-white text-xs font-semibold rounded hover:bg-[#014486] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Dispatch
        </Link>
      </div>
    );
  }

  const isDelivered = dispatch.status === 'DELIVERED';
  const isCancelled = dispatch.status === 'CANCELLED';

  // Timeline Stepper calculation
  const timelineSteps: { key: string; label: string }[] = [
    { key: 'CREATED', label: 'Order Confirmed' },
    { key: 'PENDING', label: 'Packed & Dispatched' },
    { key: 'IN_TRANSIT', label: 'In Transit' },
    { key: 'DELIVERED', label: 'Delivered' },
  ];

  let currentStepIdx = 1;
  if (dispatch.status === 'IN_TRANSIT') currentStepIdx = 2;
  if (dispatch.status === 'DELIVERED') currentStepIdx = 3;

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

      {/* HEADER BAR */}
      <div className="bg-white p-5 rounded border border-[#DDDBDA] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/dispatch"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#706E6B] hover:text-[#0176D3] transition-colors"
          >
            <ArrowLeft size={14} /> Back to Dispatch List
          </Link>

          {/* Action Buttons (Admin Only) */}
          {isAdmin && !isDelivered && !isCancelled && (
            <div className="flex items-center gap-2">
              <button
                onClick={openTrackingModal}
                className="px-3 py-1.5 border border-[#DDDBDA] hover:border-[#0176D3] text-[#0176D3] rounded text-xs font-semibold transition-colors"
              >
                {dispatch.trackingNumber ? 'Update Tracking' : 'Add Tracking'}
              </button>
              <button
                onClick={() => setIsDeliveredModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#2E844A] hover:bg-[#256B3B] text-white text-xs font-semibold rounded transition-colors shadow-sm"
              >
                <CheckCheck size={14} />
                <span>Mark Delivered</span>
              </button>
            </div>
          )}
        </div>

        {/* Dispatch Title & Meta */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center font-bold text-lg shrink-0">
              <Truck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold font-mono text-[#181818]">
                  {dispatch.dispatchNumber}
                </h1>

                {/* Status Badge */}
                {dispatch.status === 'PENDING' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF4E5] text-[#DD7A01] border border-[#F5C278]">
                    <Clock size={11} /> Pending
                  </span>
                )}
                {dispatch.status === 'IN_TRANSIT' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE]">
                    <Truck size={11} /> In Transit
                  </span>
                )}
                {dispatch.status === 'DELIVERED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF5EE] text-[#2E844A] border border-[#C3E6CD]">
                    <CheckCheck size={11} /> Delivered
                  </span>
                )}
                {dispatch.status === 'CANCELLED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF3F2] text-[#BA0517] border border-[#F8D7DA]">
                    <XCircle size={11} /> Cancelled
                  </span>
                )}

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                  <Warehouse size={12} className="text-slate-500" />
                  {dispatch.warehouse.name} ({dispatch.warehouse.code})
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-[#706E6B] mt-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  Order:{' '}
                  <Link
                    href={`/orders/${dispatch.order.id}`}
                    className="font-mono font-bold text-[#0176D3] hover:underline"
                  >
                    {dispatch.order.orderNumber}
                  </Link>
                </span>
                {isAdmin && (
                  <span className="flex items-center gap-1">
                    <Building2 size={12} className="text-slate-400" />
                    Dealer:{' '}
                    <strong className="text-slate-800">
                      {dispatch.order.dealer.businessName || dispatch.order.dealer.name}
                    </strong>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-slate-400" />
                  Dispatched: {dispatch.dispatchedAt ? formatDate(dispatch.dispatchedAt) : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2 COLUMN PANELS: DISPATCH DETAILS & SHIPPING / COURIER INFO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Dispatch Details */}
        <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#DDDBDA]">
            <Truck size={16} className="text-[#0176D3]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
              Dispatch Details
            </h3>
          </div>
          <dl className="text-xs space-y-2">
            <div className="flex justify-between">
              <dt className="text-slate-500">Dispatch Number</dt>
              <dd className="font-mono font-bold text-slate-800">{dispatch.dispatchNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Origin Warehouse</dt>
              <dd className="font-semibold text-slate-800">
                {dispatch.warehouse.name} ({dispatch.warehouse.code})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Warehouse Location</dt>
              <dd className="text-slate-700">{dispatch.warehouse.city || dispatch.warehouse.address}</dd>
            </div>
            <div className="flex justify-between border-t pt-2">
              <dt className="text-slate-500">Dispatched Date</dt>
              <dd className="text-slate-800">
                {dispatch.dispatchedAt ? formatDate(dispatch.dispatchedAt) : 'Pending'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Delivered Date</dt>
              <dd className="text-slate-800">
                {dispatch.deliveredAt ? formatDate(dispatch.deliveredAt) : 'In Progress'}
              </dd>
            </div>
            {dispatch.notes && (
              <div className="pt-2 border-t text-[11px] text-slate-600 bg-slate-50 p-2 rounded">
                <strong>Notes:</strong> {dispatch.notes}
              </div>
            )}
          </dl>
        </div>

        {/* Right: Shipping & Courier Info + Visual Stepper */}
        <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#DDDBDA]">
            <MapPin size={16} className="text-[#2E844A]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
              Courier & Delivery Tracking
            </h3>
          </div>

          <div className="text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Courier Partner:</span>
              <span className="font-bold text-slate-900">
                {dispatch.courierName || 'Not Assigned Yet'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tracking Number / AWB:</span>
              <span className="font-mono font-bold text-[#0176D3]">
                {dispatch.trackingNumber ? (
                  dispatch.trackingNumber.startsWith('http') ? (
                    <a
                      href={dispatch.trackingNumber}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      <span>Track Shipment</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    dispatch.trackingNumber
                  )
                ) : (
                  <span className="text-slate-400 font-normal">Awaiting AWB</span>
                )}
              </span>
            </div>
          </div>

          {/* Stepper */}
          <div className="pt-4 border-t border-[#DDDBDA]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
              Shipment Progress
            </div>
            <div className="relative flex items-center justify-between px-2">
              {timelineSteps.map((step, idx) => {
                const isPassed = currentStepIdx > idx;
                const isCurrent = currentStepIdx === idx;

                return (
                  <div key={step.key} className="flex-1 relative flex flex-col items-center">
                    {idx < timelineSteps.length - 1 && (
                      <div
                        className={`absolute top-3 left-1/2 w-full h-0.5 z-0 transition-colors ${
                          currentStepIdx > idx ? 'bg-[#0176D3]' : 'bg-[#DDDBDA]'
                        }`}
                      />
                    )}
                    <div
                      className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        isPassed
                          ? 'bg-[#0176D3] text-white'
                          : isCurrent
                          ? 'bg-[#0176D3] text-white ring-4 ring-[#D4E7F9] animate-pulse'
                          : 'bg-white border-2 border-[#DDDBDA] text-slate-400'
                      }`}
                    >
                      {isPassed ? <Check size={12} /> : idx + 1}
                    </div>
                    <span
                      className={`mt-1.5 text-[10px] text-center font-semibold ${
                        isCurrent
                          ? 'text-[#0176D3]'
                          : isPassed
                          ? 'text-[#181818]'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* DISPATCH ITEMS TABLE */}
      <div className="bg-white rounded border border-[#DDDBDA] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#DDDBDA] bg-[#F8F9FA] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
            Dispatched Items ({dispatch.items.length})
          </h3>
          <span className="text-xs text-slate-500">Shipped in this fulfillment consignment</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] text-[#706E6B] font-semibold uppercase text-[10px] tracking-wider border-b border-[#DDDBDA]">
                <th className="py-2.5 px-4">Product Name</th>
                <th className="py-2.5 px-4">Variant</th>
                <th className="py-2.5 px-4">SKU</th>
                <th className="py-2.5 px-4 text-right">Quantity Dispatched</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDDBDA]">
              {dispatch.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-[#181818]">
                    {item.productVariant.product.name}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {item.productVariant.name}
                    {item.productVariant.packingDetails && ` (${item.productVariant.packingDetails})`}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    {item.productVariant.sku}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                    {item.quantity} units
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* LINKED ORDER PANEL */}
      <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#DDDBDA]">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#0176D3]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
              Linked Sales Order
            </h3>
          </div>
          <Link
            href={`/orders/${dispatch.order.id}`}
            className="text-xs font-semibold text-[#0176D3] hover:underline flex items-center gap-1"
          >
            <span>View Full Order #{dispatch.order.orderNumber}</span>
            <ExternalLink size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Order Number</span>
            <span className="font-mono font-bold text-slate-800 block mt-0.5">
              {dispatch.order.orderNumber}
            </span>
          </div>
          <div className="p-3 rounded bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Order Status</span>
            <span className="font-bold text-[#0176D3] block mt-0.5">
              {dispatch.order.status}
            </span>
          </div>
          <div className="p-3 rounded bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Dealer</span>
            <span className="font-semibold text-slate-800 block mt-0.5">
              {dispatch.order.dealer.businessName || dispatch.order.dealer.name}
            </span>
          </div>
          <div className="p-3 rounded bg-slate-50 border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Shipping Destination</span>
            <span className="font-medium text-slate-700 block mt-0.5 truncate">
              {dispatch.order.shippingAddress?.city}, {dispatch.order.shippingAddress?.state}
            </span>
          </div>
        </div>
      </div>

      {/* STOCK IMPACT PANEL (Admin Only) */}
      {isAdmin && (
        <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#DDDBDA]">
            <Boxes size={16} className="text-[#2E844A]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
              Warehouse Inventory Impact
            </h3>
          </div>

          <div className="text-xs text-slate-600 space-y-2">
            <p>
              On dispatch creation, reserved stock was released and physical stock was deducted from{' '}
              <strong>{dispatch.warehouse.name} ({dispatch.warehouse.code})</strong>:
            </p>
            <div className="space-y-1">
              {dispatch.items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-xs"
                >
                  <span className="font-medium text-slate-800">
                    {it.productVariant.name} ({it.productVariant.sku})
                  </span>
                  <span className="font-bold text-[#BA0517]">
                    -{it.quantity} physical & -{it.quantity} reserved
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* UPDATE TRACKING MODAL */}
      {isTrackingOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[460px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#4338CA] flex items-center justify-center font-bold">
                  <Truck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Courier Tracking</h3>
                  <p className="text-[11px] font-mono text-[#706E6B]">{dispatch.dispatchNumber}</p>
                </div>
              </div>
              <button onClick={() => setIsTrackingOpen(false)} className="text-slate-400 hover:text-slate-600">
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
                    placeholder="e.g. Blue Dart / Delhivery"
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
                    Saving tracking updates the dispatch status to <strong>IN TRANSIT</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">Notes</label>
                  <input
                    type="text"
                    value={trackingNotes}
                    onChange={(e) => setTrackingNotes(e.target.value)}
                    placeholder="e.g. Delivery expected by Friday"
                    className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                  />
                </div>
              </div>

              <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTrackingOpen(false)}
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

      {/* MARK DELIVERED MODAL */}
      {isDeliveredModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[460px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EBF5EE] text-[#2E844A] flex items-center justify-center font-bold">
                  <CheckCheck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Confirm Delivery</h3>
                  <p className="text-[11px] font-mono text-[#706E6B]">{dispatch.dispatchNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDeliveredModalOpen(false)}
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
                    {dispatch.order.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dealer:</span>
                  <span className="font-semibold text-slate-800">
                    {dispatch.order.dealer.businessName || dispatch.order.dealer.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Items Count:</span>
                  <span className="text-slate-800">{pluralize(dispatch.items.length, "item")}</span>
                </div>
              </div>

              <p className="text-xs text-slate-600">
                Confirm that this consignment has been physically delivered to the recipient?
              </p>
            </div>

            <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2">
              <button
                onClick={() => setIsDeliveredModalOpen(false)}
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
