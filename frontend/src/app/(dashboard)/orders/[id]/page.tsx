'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShoppingBag,
  CheckCircle,
  XCircle,
  Clock,
  Check,
  Package,
  Truck,
  CheckCheck,
  Building2,
  MapPin,
  CreditCard,
  Download,
  AlertCircle,
  X,
  Loader2,
  FileText,
  Calendar,
  Phone,
  Mail,
  Plus,
  Send,
  ExternalLink,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  useGetOrderByIdQuery,
  useConfirmOrderMutation,
  useCancelOrderMutation,
  useAddOrderPaymentMutation,
  OrderStatusType,
  PaymentStatusType,
} from '@/features/orders/ordersApi';
import { toast } from '@/components/ui/toast';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { user, token } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'ADMIN';

  const { data: orderData, isLoading, isError, refetch } = useGetOrderByIdQuery(orderId);
  const [confirmOrder, { isLoading: isConfirming }] = useConfirmOrderMutation();
  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();
  const [addPayment, { isLoading: isAddingPayment }] = useAddOrderPaymentMutation();

  // Modals & form state
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'BANK_TRANSFER',
    referenceId: '',
    notes: '',
  });
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const order = orderData?.data;

  // Handle Confirm
  const handleConfirm = async () => {
    if (!order) return;
    try {
      await confirmOrder(order.id).unwrap();
      setFeedbackMsg({ type: 'success', text: `Order #${order.orderNumber} confirmed successfully.` });
      setTimeout(() => setFeedbackMsg(null), 4000);
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.data?.message || 'Failed to confirm order' });
    }
  };

  // Handle Cancel
  const handleCancel = async () => {
    if (!order) return;
    try {
      await cancelOrder(order.id).unwrap();
      setIsCancelOpen(false);
      setFeedbackMsg({
        type: 'success',
        text: `Order #${order.orderNumber} cancelled. Reserved stock released and credit limit restored.`,
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.data?.message || 'Failed to cancel order' });
    }
  };

  // Handle Add Payment
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const amountNum = parseFloat(paymentForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    try {
      await addPayment({
        orderId: order.id,
        amount: amountNum,
        paymentMethod: paymentForm.paymentMethod,
        referenceId: paymentForm.referenceId,
        notes: paymentForm.notes,
      }).unwrap();
      setIsPaymentModalOpen(false);
      setPaymentForm({
        amount: '',
        paymentMethod: 'BANK_TRANSFER',
        referenceId: '',
        notes: '',
      });
      setFeedbackMsg({ type: 'success', text: 'Payment record submitted successfully.' });
      setTimeout(() => setFeedbackMsg(null), 4000);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to submit payment');
    }
  };

  // Handle Invoice PDF Download
  const handleDownloadInvoice = async () => {
    if (!order) return;
    setIsDownloadingPdf(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${baseUrl}/invoices/${order.id}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to download invoice PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${order.invoiceNumber || order.orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      toast.error(err.message || 'Could not download invoice');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Loader2 size={24} className="animate-spin text-[#0176D3]" />
        <p className="text-xs">Loading order details...</p>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="bg-white rounded border border-[#DDDBDA] p-12 text-center space-y-3">
        <AlertCircle size={40} className="mx-auto text-[#BA0517]" />
        <h2 className="text-base font-bold text-[#181818]">Order Not Found</h2>
        <p className="text-xs text-[#706E6B]">The requested order does not exist or access is denied.</p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] text-white text-xs font-semibold rounded hover:bg-[#014486] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Orders
        </Link>
      </div>
    );
  }

  // Stepper timeline configuration
  const steps: { key: OrderStatusType; label: string }[] = [
    { key: 'PENDING', label: 'Placed' },
    { key: 'CONFIRMED', label: 'Confirmed' },
    { key: 'PROCESSING', label: 'Processing' },
    { key: 'DISPATCHED', label: 'Dispatched' },
    { key: 'DELIVERED', label: 'Delivered' },
  ];

  const statusHierarchy: Record<OrderStatusType, number> = {
    PENDING: 0,
    CONFIRMED: 1,
    PROCESSING: 2,
    PARTIALLY_DISPATCHED: 3,
    DISPATCHED: 3,
    DELIVERED: 4,
    CANCELLED: -1,
  };

  const currentStepIndex = statusHierarchy[order.status];
  const isCancelled = order.status === 'CANCELLED';

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
            href="/orders"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#706E6B] hover:text-[#0176D3] transition-colors"
          >
            <ArrowLeft size={14} /> Back to Orders
          </Link>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Admin: Confirm pending order */}
            {isAdmin && order.status === 'PENDING' && (
              <button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E844A] hover:bg-[#256B3B] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
              >
                {isConfirming && <Loader2 size={13} className="animate-spin" />}
                Confirm Order
              </button>
            )}

            {/* Admin or Dealer: Cancel */}
            {(isAdmin ? order.status === 'PENDING' || order.status === 'CONFIRMED' : order.status === 'PENDING') && (
              <button
                onClick={() => setIsCancelOpen(true)}
                className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:text-[#BA0517] hover:border-[#BA0517] text-xs font-medium rounded transition-colors"
              >
                Cancel Order
              </button>
            )}

            {/* Invoice Download */}
            {(order.invoiceNumber || order.status === 'DISPATCHED' || order.status === 'DELIVERED') && (
              <button
                onClick={handleDownloadInvoice}
                disabled={isDownloadingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
              >
                {isDownloadingPdf ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                <span>Download Invoice PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* Order Identity & Meta */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center font-bold text-lg shrink-0">
              <ShoppingBag size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold font-mono text-[#181818]">{order.orderNumber}</h1>

                {/* Status Badge */}
                {order.status === 'PENDING' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF4E5] text-[#DD7A01] border border-[#F5C278]">
                    <Clock size={11} /> Pending
                  </span>
                )}
                {order.status === 'CONFIRMED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EAF5FE] text-[#0176D3] border border-[#B0D5F8]">
                    <CheckCircle size={11} /> Confirmed
                  </span>
                )}
                {order.status === 'PROCESSING' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F3E8FF] text-[#7E22CE] border border-[#DDD6FE]">
                    <Package size={11} /> Processing
                  </span>
                )}
                {order.status === 'PARTIALLY_DISPATCHED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF8E7] text-[#B45309] border border-[#FDE68A]">
                    <Truck size={11} /> Partially Dispatched
                  </span>
                )}
                {order.status === 'DISPATCHED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE]">
                    <Truck size={11} /> Dispatched
                  </span>
                )}
                {order.status === 'DELIVERED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF5EE] text-[#2E844A] border border-[#C3E6CD]">
                    <CheckCheck size={11} /> Delivered
                  </span>
                )}
                {order.status === 'CANCELLED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF3F2] text-[#BA0517] border border-[#F8D7DA]">
                    <XCircle size={11} /> Cancelled
                  </span>
                )}

                {/* Payment Badge */}
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    order.paymentStatus === 'PAID'
                      ? 'bg-[#EBF5EE] text-[#2E844A]'
                      : order.paymentStatus === 'PARTIALLY_PAID'
                      ? 'bg-[#FFF8E7] text-[#DD7A01]'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Payment: {order.paymentStatus}
                </span>

                {order.invoiceNumber && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-mono text-xs font-semibold bg-slate-100 text-slate-800">
                    <FileText size={12} className="text-slate-500" />
                    {order.invoiceNumber}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-[#706E6B] mt-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-slate-400" />
                  Placed: {formatDate(order.createdAt)}
                </span>
                {isAdmin && (
                  <span className="flex items-center gap-1">
                    <Building2 size={12} className="text-slate-400" />
                    Dealer: <strong className="text-slate-800">{order.dealer.businessName || order.dealer.name}</strong>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  Warehouse: <span className="font-semibold text-slate-800">{order.warehouse.name} ({order.warehouse.code})</span>
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-[#706E6B]">Grand Total</div>
            <div className="text-2xl font-bold text-[#181818]">
              {formatCurrency(order.grandTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* ORDER STATUS TIMELINE (HORIZONTAL STEPPER) */}
      <div className="bg-white p-5 rounded border border-[#DDDBDA] shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#706E6B] mb-5">
          Order Status Lifecycle
        </h3>

        {isCancelled ? (
          <div className="p-4 rounded-lg bg-[#FDF3F2] border border-[#F8D7DA] flex items-center gap-3 text-xs text-[#BA0517]">
            <XCircle size={20} className="shrink-0" />
            <div>
              <strong>Order Cancelled:</strong> Stock reservation was released and credit limit was restored to dealer account.
            </div>
          </div>
        ) : (
          <div className="relative flex items-center justify-between px-4 sm:px-10">
            {steps.map((step, idx) => {
              const isPassed = currentStepIndex > idx;
              const isCurrent = currentStepIndex === idx;
              const isFuture = currentStepIndex < idx;

              return (
                <div key={step.key} className="flex-1 relative flex flex-col items-center">
                  {/* Connector Line */}
                  {idx < steps.length - 1 && (
                    <div
                      className={`absolute top-3.5 left-1/2 w-full h-0.5 z-0 transition-colors ${
                        currentStepIndex > idx ? 'bg-[#0176D3]' : 'bg-[#DDDBDA]'
                      }`}
                    />
                  )}

                  {/* Step Circle */}
                  <div
                    className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isPassed
                        ? 'bg-[#0176D3] text-white'
                        : isCurrent
                        ? 'bg-[#0176D3] text-white ring-4 ring-[#D4E7F9] shadow-xs animate-pulse'
                        : 'bg-white border-2 border-[#DDDBDA] text-slate-400'
                    }`}
                  >
                    {isPassed ? <Check size={14} /> : idx + 1}
                  </div>

                  {/* Label */}
                  <div
                    className={`mt-2 text-xs font-semibold text-center ${
                      isCurrent
                        ? 'text-[#0176D3]'
                        : isPassed
                        ? 'text-[#181818]'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ORDER ITEMS TABLE */}
      <div className="bg-white rounded border border-[#DDDBDA] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#DDDBDA] bg-[#F8F9FA] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
            Order Items ({order.items.length})
          </h3>
          <span className="text-xs text-slate-500">All prices include applicable GST</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] text-[#706E6B] font-semibold uppercase text-[10px] tracking-wider border-b border-[#DDDBDA]">
                <th className="py-2.5 px-4">Product & Variant</th>
                <th className="py-2.5 px-4">SKU</th>
                <th className="py-2.5 px-4 text-center">Qty</th>
                <th className="py-2.5 px-4 text-right">Unit Price</th>
                <th className="py-2.5 px-4 text-right">Discount</th>
                <th className="py-2.5 px-4 text-right">Taxable</th>
                <th className="py-2.5 px-4 text-right">GST</th>
                <th className="py-2.5 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDDBDA]">
              {order.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-[#181818]">
                      {item.productVariant.product.name}
                    </div>
                    <div className="text-[11px] text-[#706E6B]">
                      {item.productVariant.name}
                      {item.productVariant.packingDetails && ` (${item.productVariant.packingDetails})`}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    {item.productVariant.sku}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-800">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-700">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="py-3 px-4 text-right text-[#2E844A]">
                    {Number(item.dealerDiscount) > 0 ? `${Number(item.dealerDiscount).toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-800">
                    {formatCurrency(item.total)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    <div>{formatCurrency(item.gstAmount)}</div>
                    <div className="text-[10px] text-slate-400">{item.gstPercentage}%</div>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatCurrency(Number(item.total) + Number(item.gstAmount))}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* FOOTER ROW SUMMARY */}
            <tfoot className="bg-[#F8F9FA] border-t-2 border-[#DDDBDA] text-xs">
              <tr>
                <td colSpan={5} className="py-2 px-4 text-right font-semibold text-slate-600">
                  Subtotal (Taxable):
                </td>
                <td className="py-2 px-4 text-right font-semibold text-slate-800">
                  {formatCurrency(order.subtotal)}
                </td>
                <td className="py-2 px-4 text-right font-semibold text-slate-800">
                  {formatCurrency(order.totalGST)}
                </td>
                <td className="py-2 px-4 text-right font-bold text-slate-900">
                  {formatCurrency(order.grandTotal)}
                </td>
              </tr>
              {order.discount > 0 && (
                <tr>
                  <td colSpan={7} className="py-1 px-4 text-right text-[11px] text-[#2E844A]">
                    Total Dealer Discounts Applied:
                  </td>
                  <td className="py-1 px-4 text-right font-semibold text-[#2E844A]">
                    -{formatCurrency(order.discount)}
                  </td>
                </tr>
              )}
              <tr className="border-t border-[#DDDBDA]">
                <td colSpan={7} className="py-2.5 px-4 text-right font-bold text-sm text-[#181818]">
                  Grand Total:
                </td>
                <td className="py-2.5 px-4 text-right font-extrabold text-sm text-[#0176D3]">
                  {formatCurrency(order.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 2 COLUMN PANELS: DEALER & SHIPPING ADDRESS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dealer Info */}
        <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#DDDBDA]">
            <Building2 size={16} className="text-[#0176D3]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
              Dealer Information
            </h3>
          </div>
          <div className="text-xs space-y-1.5">
            <div className="font-bold text-slate-900">
              {order.dealer.businessName || order.dealer.name}
            </div>
            <div className="text-slate-600">Contact: {order.dealer.name}</div>
            <div className="text-slate-600">Email: {order.dealer.email}</div>
            {order.dealer.phone && <div className="text-slate-600">Phone: {order.dealer.phone}</div>}
            {order.dealer.gstNumber && (
              <div className="text-slate-700 font-mono">GSTIN: {order.dealer.gstNumber}</div>
            )}
            <div className="pt-1 text-slate-500 text-[11px]">
              Fulfillment Warehouse:{' '}
              <strong className="text-slate-700">{order.warehouse.name} ({order.warehouse.code})</strong>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#DDDBDA]">
            <MapPin size={16} className="text-[#2E844A]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
              Shipping Address
            </h3>
          </div>
          <div className="text-xs space-y-1.5">
            <div className="font-bold text-slate-900">
              {order.shippingAddress?.name || order.dealer.name}
            </div>
            {order.shippingAddress?.phone && (
              <div className="text-slate-600">Phone: {order.shippingAddress.phone}</div>
            )}
            <div className="text-slate-700">{order.shippingAddress?.address}</div>
            {(() => {
              const sa = order.shippingAddress;
              const place = [sa?.city, sa?.state].filter((v: string) => v && v !== 'N/A').join(', ');
              const pin = sa?.pincode && sa.pincode !== 'N/A' ? sa.pincode : '';
              const line = [place, pin].filter(Boolean).join(' - ');
              return line ? <div className="text-slate-700">{line}</div> : null;
            })()}
            {order.notes && (
              <div className="pt-2 border-t mt-2 text-[11px] text-amber-800 bg-amber-50 p-2 rounded">
                <strong>Notes:</strong> {order.notes}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DISPATCH & FULFILLMENT SECTION */}
      <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#DDDBDA]">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-[#0176D3]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
              Dispatches & Tracking ({order.dispatches?.length || 0})
            </h3>
          </div>
        </div>

        {(!order.dispatches || order.dispatches.length === 0) ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No dispatches initiated yet. Orders are dispatched once packed at the warehouse.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#DDDBDA] rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] text-[#706E6B] font-semibold uppercase text-[10px] tracking-wider border-b border-[#DDDBDA]">
                  <th className="py-2 px-3">Dispatch #</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Courier</th>
                  <th className="py-2 px-3">Tracking #</th>
                  <th className="py-2 px-3 text-right">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDDBDA]">
                {order.dispatches.map((dsp) => (
                  <tr key={dsp.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#0176D3]">
                      {dsp.dispatchNumber}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {dsp.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{dsp.courierName || '—'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-800">
                      {dsp.trackingNumber || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {dsp.dispatchedAt ? formatDate(dsp.dispatchedAt) : 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PAYMENT & SETTLEMENT SECTION */}
      <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#DDDBDA]">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-[#2E844A]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
              Payments & Settlements ({order.payments?.length || 0})
            </h3>
          </div>
          {order.paymentStatus !== 'PAID' && (
            <button
              onClick={() => {
                setPaymentForm({
                  amount: String(order.grandTotal),
                  paymentMethod: 'BANK_TRANSFER',
                  referenceId: '',
                  notes: '',
                });
                setIsPaymentModalOpen(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#DDDBDA] hover:border-[#0176D3] text-[#0176D3] text-xs font-semibold rounded transition-colors shadow-xs"
            >
              <Plus size={13} />
              <span>Record / Add Payment</span>
            </button>
          )}
        </div>

        {(!order.payments || order.payments.length === 0) ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No payments recorded yet for this order. Payment terms: {order.creditDaysForOrder || 30} days.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#DDDBDA] rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] text-[#706E6B] font-semibold uppercase text-[10px] tracking-wider border-b border-[#DDDBDA]">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Method</th>
                  <th className="py-2 px-3">Reference / UTR</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDDBDA]">
                {order.payments.map((pmt) => (
                  <tr key={pmt.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-600">{formatDate(pmt.createdAt)}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {pmt.paymentMethod || 'BANK_TRANSFER'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {pmt.referenceId || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          pmt.status === 'PAID'
                            ? 'bg-[#EBF5EE] text-[#2E844A]'
                            : 'bg-[#FFF8E7] text-[#DD7A01]'
                        }`}
                      >
                        {pmt.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(pmt.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CANCEL MODAL */}
      {isCancelOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[460px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FDF3F2] text-[#BA0517] flex items-center justify-center font-bold">
                  <XCircle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Cancel Order</h3>
                  <p className="text-[11px] font-mono text-[#706E6B]">{order.orderNumber}</p>
                </div>
              </div>
              <button onClick={() => setIsCancelOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="p-3.5 rounded bg-[#FDF3F2] border border-[#F8D7DA] text-xs text-[#BA0517] space-y-1">
                <p className="font-semibold">
                  Cancel order <span className="font-mono">{order.orderNumber}</span>?
                </p>
                <p className="text-slate-700 text-[11px]">
                  Reserved stock will be released and credit limit will be restored by{' '}
                  <span className="font-bold">{formatCurrency(order.grandTotal)}</span>.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Are you sure you want to cancel this order?
              </div>
            </div>

            <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2">
              <button
                onClick={() => setIsCancelOpen(false)}
                className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:bg-white text-xs font-medium rounded transition-colors"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancel}
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

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[440px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EBF5EE] text-[#2E844A] flex items-center justify-center font-bold">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Record Payment</h3>
                  <p className="text-[11px] font-mono text-[#706E6B]">{order.orderNumber}</p>
                </div>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddPayment}>
              <div className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">
                    Payment Amount (₹) <span className="text-[#BA0517]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">
                    Payment Method <span className="text-[#BA0517]">*</span>
                  </label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] bg-white"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">
                    Reference / UTR / Cheque Number
                  </label>
                  <input
                    type="text"
                    value={paymentForm.referenceId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceId: e.target.value })}
                    placeholder="e.g. UTR1234567890"
                    className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    placeholder="e.g. Paid via HDFC Netbanking"
                    className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                  />
                </div>
              </div>

              <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:bg-white text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingPayment}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
                >
                  {isAddingPayment && <Loader2 size={12} className="animate-spin" />}
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
