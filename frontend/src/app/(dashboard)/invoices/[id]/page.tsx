'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Download,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Calendar,
  Building,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Landmark,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { formatCurrency, formatDate, numberToWordsIndian } from '@/lib/utils';
import {
  useGetInvoiceByIdQuery,
  useGetPublicSettingsQuery,
  PaymentStatusType,
} from '@/features/invoices/invoicesApi';
import { toast } from '@/components/ui/toast';

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, token } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'ADMIN';

  const { data: invResponse, isLoading, isError, error } = useGetInvoiceByIdQuery(id);
  const { data: settingsResponse } = useGetPublicSettingsQuery();

  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const invoice = invResponse?.data;
  const company = settingsResponse?.data?.company;
  const bank = settingsResponse?.data?.bankDetails;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      setIsDownloading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${baseUrl}/invoices/${invoice.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to generate invoice PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      toast.error(err.message || 'Error downloading PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0176D3] mb-3" />
        <p className="text-xs text-[#706E6B]">Loading invoice details...</p>
      </div>
    );
  }

  if (isError || !invoice) {
    const errorMsg = (error as any)?.data?.message || 'Invoice not found or access denied';
    return (
      <div className="bg-white rounded border border-[#DDDBDA] p-12 text-center max-w-lg mx-auto mt-12 shadow-sm">
        <AlertCircle className="w-12 h-12 text-[#BA0517] mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800 mb-1">
          Unable to Load Invoice
        </h2>
        <p className="text-xs text-slate-500 mb-6">{errorMsg}</p>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0176D3] hover:bg-[#014486] rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>
      </div>
    );
  }

  // Due Date calculation
  const creditDays = invoice.creditDaysForOrder ?? 30;
  const issueTime = new Date(invoice.createdAt).getTime();
  const dueTime = issueTime + creditDays * 24 * 60 * 60 * 1000;
  const dueDate = new Date(dueTime);
  const isOverdue = Date.now() > dueTime && invoice.paymentStatus !== 'PAID';

  const renderPaymentBadge = (status: PaymentStatusType) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E3F5E9] text-[#2E844A] border border-[#A3E2B5]">
            <CheckCircle className="w-3.5 h-3.5" />
            PAID
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EAF5FE] text-[#0176D3] border border-[#B0D5FC]">
            <Clock className="w-3.5 h-3.5" />
            PARTIALLY PAID
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FDE8E8] text-[#BA0517] border border-[#F8B4B4]">
            <XCircle className="w-3.5 h-3.5" />
            REJECTED
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3D6] text-[#DD7A01] border border-[#FAD889]">
            <Clock className="w-3.5 h-3.5" />
            PENDING PAYMENT
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* NAVIGATION / TOP BREADCRUMB */}
      <div className="flex items-center justify-between">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0176D3] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Invoices
        </Link>
      </div>

      {/* HEADER CARD */}
      <div className="bg-white rounded border border-[#DDDBDA] p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h1 className="text-xl font-bold font-mono text-[#181818] tracking-tight">
              {invoice.invoiceNumber}
            </h1>
            {renderPaymentBadge(invoice.paymentStatus)}
            {isOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-[#FDE8E8] text-[#BA0517] border border-[#F8B4B4]">
                <AlertCircle className="w-3 h-3" />
                Overdue
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#706E6B]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Issue Date: <strong>{formatDate(invoice.createdAt)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className={isOverdue ? 'text-[#BA0517] font-semibold' : ''}>
                Due Date: <strong>{formatDate(dueDate)}</strong> ({creditDays} days credit)
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Link
            href={`/orders/${invoice.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Order
          </Link>

          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#0176D3] hover:bg-[#014486] rounded transition-colors shadow-xs disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download PDF
          </button>
        </div>
      </div>

      {/* 2-COLUMN FROM / BILL-TO PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: From (NexTrade) */}
        <div className="bg-white rounded border border-[#DDDBDA] p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              From (Billed By)
            </span>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-blue-50 text-[#0176D3] border border-blue-100">
              ORIGIN: {invoice.warehouse?.code}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {company?.name || 'NexTrade Industrial Technologies'}
            </h3>
            <div className="mt-1 text-xs text-slate-600 space-y-0.5 leading-relaxed">
              <p>{company?.address || '401 Trade Avenue, Kurla West'}</p>
              <p>
                {company?.city || 'Mumbai'}, {company?.state || 'Maharashtra'} -{' '}
                {company?.pincode || '400070'}
              </p>
              <p className="font-mono text-slate-700 pt-1">
                <strong>GSTIN:</strong> {company?.gstNumber || '27AAACN5432B1Z8'}
              </p>
              <p className="text-slate-500">
                Email: {company?.email || 'contact@nextrade.com'} | Phone:{' '}
                {company?.phone || '+91 98200 12345'}
              </p>
            </div>
          </div>

          {/* Warehouse Dispatch Note */}
          <div className="bg-[#F8F9FA] rounded p-2.5 text-[11px] border border-slate-200">
            <span className="font-semibold text-slate-700">Dispatch Hub: </span>
            <span className="text-slate-600">
              {invoice.warehouse?.name} ({invoice.warehouse?.city},{' '}
              {invoice.warehouse?.state})
            </span>
          </div>
        </div>

        {/* Right: Bill To (Dealer) */}
        <div className="bg-white rounded border border-[#DDDBDA] p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Bill To (Dealer)
            </span>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              ORDER #{invoice.orderNumber}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {invoice.dealer.businessName || invoice.dealer.name}
            </h3>
            <div className="mt-1 text-xs text-slate-600 space-y-0.5 leading-relaxed">
              <p>{invoice.dealer.businessAddress || 'Address on file'}</p>
              <p className="font-mono text-slate-700 pt-1">
                <strong>GSTIN:</strong>{' '}
                {invoice.dealer.gstNumber || 'Unregistered / Exempt'}
              </p>
              <p className="text-slate-500">
                Contact: {invoice.dealer.name} | Phone: {invoice.dealer.phone}
              </p>
              <p className="text-slate-500">Email: {invoice.dealer.email}</p>
            </div>
          </div>

          {/* Shipping Address */}
          {invoice.shippingAddress && (
            <div className="bg-[#F8F9FA] rounded p-2.5 text-[11px] border border-slate-200">
              <span className="font-semibold text-slate-700">Ship To: </span>
              <span className="text-slate-600">
                {invoice.shippingAddress.address}, {invoice.shippingAddress.city},{' '}
                {invoice.shippingAddress.state} - {invoice.shippingAddress.pincode}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* INVOICE ITEMS TABLE */}
      <div className="bg-white rounded border border-[#DDDBDA] shadow-sm overflow-hidden">
        <div className="p-3 bg-[#F8F9FA] border-b border-[#DDDBDA] flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Line Items ({invoice.items?.length || 0})
          </span>
          <span className="text-[11px] text-slate-500">
            All amounts in Indian Rupees (INR ₹)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F4F6F9] border-b border-[#DDDBDA] text-[#706E6B] font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3 w-8 text-center">#</th>
                <th className="py-2.5 px-3">Product Description</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Disc %</th>
                <th className="py-2.5 px-3 text-right">Taxable</th>
                <th className="py-2.5 px-3 text-right">GST %</th>
                <th className="py-2.5 px-3 text-right">GST Amt</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-800">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDDBDA]">
              {invoice.items?.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-800">
                      {item.productVariant.product.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {item.productVariant.name}
                      {item.productVariant.packingDetails && ` (${item.productVariant.packingDetails})`}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                    {item.productVariant.sku}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {Number(item.dealerDiscount) > 0 ? `${Number(item.dealerDiscount)}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                    {formatCurrency(item.total)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                    {item.gstPercentage}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                    {formatCurrency(item.gstAmount)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                    {formatCurrency(Number(item.total) + Number(item.gstAmount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SUMMARY / FOOTER TOTALS */}
        <div className="bg-[#F8F9FA] border-t border-[#DDDBDA] p-4 flex flex-col md:flex-row justify-between gap-4">
          {/* Amount in words */}
          <div className="max-w-md">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Amount in Words:
            </span>
            <p className="text-xs font-semibold text-slate-800 italic mt-0.5 leading-relaxed bg-white p-2.5 rounded border border-slate-200">
              {numberToWordsIndian(invoice.grandTotal)}
            </p>
          </div>

          {/* Breakdown Numbers */}
          <div className="w-full md:w-72 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal (Net Taxable):</span>
              <span className="font-mono">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-[#2E844A]">
                <span>Total Discount:</span>
                <span className="font-mono">-{formatCurrency(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Total GST:</span>
              <span className="font-mono">{formatCurrency(invoice.totalGST)}</span>
            </div>
            <div className="border-t border-[#DDDBDA] pt-2 flex justify-between text-sm font-bold text-slate-900">
              <span>Grand Total:</span>
              <span className="font-mono text-[#0176D3]">
                {formatCurrency(invoice.grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PAYMENT TERMS & BANK DETAILS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Terms */}
        <div className="bg-white rounded border border-[#DDDBDA] p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Clock className="w-4 h-4 text-[#0176D3]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Payment Terms & Credit
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Credit Period:</span>
              <span className="font-semibold text-slate-800">
                {creditDays} Days from Invoice Date
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Due By:</span>
              <span
                className={`font-semibold ${
                  isOverdue ? 'text-[#BA0517]' : 'text-slate-800'
                }`}
              >
                {formatDate(dueDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Status:</span>
              <div>{renderPaymentBadge(invoice.paymentStatus)}</div>
            </div>

            {isOverdue && (
              <div className="mt-2 bg-[#FDE8E8] border border-[#F8B4B4] rounded p-2.5 text-xs text-[#BA0517] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  This invoice is overdue. Please settle immediately to avoid credit limit hold.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bank Details for NEFT/RTGS */}
        <div className="bg-white rounded border border-[#DDDBDA] p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#0176D3]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Bank Details (NEFT / RTGS / UPI)
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Official Beneficiary</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Bank Name:</span>
              <span className="font-semibold text-slate-800">
                {bank?.bankName || 'HDFC Bank'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Account Number:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-900">
                  {bank?.accountNumber || '50200088991122'}
                </span>
                <button
                  onClick={() =>
                    handleCopy(bank?.accountNumber || '50200088991122', 'acc')
                  }
                  title="Copy Account Number"
                  className="text-slate-400 hover:text-slate-600"
                >
                  {copiedField === 'acc' ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">IFSC Code:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-900">
                  {bank?.ifscCode || 'HDFC0001234'}
                </span>
                <button
                  onClick={() =>
                    handleCopy(bank?.ifscCode || 'HDFC0001234', 'ifsc')
                  }
                  title="Copy IFSC"
                  className="text-slate-400 hover:text-slate-600"
                >
                  {copiedField === 'ifsc' ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">UPI ID:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-[#0176D3]">
                  {bank?.upiId || 'nextrade@hdfcbank'}
                </span>
                <button
                  onClick={() =>
                    handleCopy(bank?.upiId || 'nextrade@hdfcbank', 'upi')
                  }
                  title="Copy UPI ID"
                  className="text-slate-400 hover:text-slate-600"
                >
                  {copiedField === 'upi' ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAYMENT HISTORY SECTION */}
      <div className="bg-white rounded border border-[#DDDBDA] shadow-sm overflow-hidden">
        <div className="p-3 bg-[#F8F9FA] border-b border-[#DDDBDA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Payment History
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            {invoice.payments?.length || 0} recorded transaction(s)
          </span>
        </div>

        {invoice.payments && invoice.payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F4F6F9] border-b border-[#DDDBDA] text-[#706E6B] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Reference / UTR</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDDBDA]">
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-600">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {p.paymentMethod || 'BANK_TRANSFER'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {p.referenceId || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {renderPaymentBadge(p.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500">
            No payment transactions recorded for this invoice yet.
          </div>
        )}
      </div>
    </div>
  );
}
