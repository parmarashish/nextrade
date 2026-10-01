'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Building2,
  MapPin,
  FileText,
  CreditCard,
  Loader2,
  Package,
  ShoppingBag,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { formatCurrency } from '@/lib/utils';
import { useGetCartQuery, useCheckoutMutation } from '@/features/orders/ordersApi';
import { useGetDealerProfileQuery } from '@/features/dealers/dealersApi';
import { toast } from '@/components/ui/toast';

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'ADMIN';

  // Guard: Admin should redirect to /orders
  useEffect(() => {
    if (isAdmin) {
      router.replace('/orders');
    }
  }, [isAdmin, router]);

  const { data: cartData, isLoading: isCartLoading } = useGetCartQuery();
  const { data: profileData, isLoading: isProfileLoading } = useGetDealerProfileQuery(undefined, {
    skip: isAdmin,
  });
  const [checkout, { isLoading: isSubmitting }] = useCheckoutMutation();

  const cart = cartData?.data;
  const items = cart?.items || [];
  const summary = cart?.summary || {
    totalItems: 0,
    subtotal: 0,
    totalDiscount: 0,
    totalGST: 0,
    grandTotal: 0,
  };

  const dealer = profileData?.data;

  // Shipping Form State
  const [shippingAddress, setShippingAddress] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Prefill shipping address when dealer profile loads
  useEffect(() => {
    if (dealer) {
      // Profile address is stored as "street, City, State - PIN"; split it so the fields match the profile.
      const full = dealer.businessAddress || '';
      const m = full.match(/^(.*),\s*([^,]+),\s*([^,]+?)\s*-\s*(\d{6})\s*$/);
      setShippingAddress({
        name: dealer.businessName || dealer.name || '',
        phone: dealer.phone || '',
        address: m ? m[1].trim() : full,
        city: m ? m[2].trim() : '',
        state: m ? m[3].trim() : '',
        pincode: m ? m[4] : '',
      });
    }
  }, [dealer]);

  const remainingCredit = dealer ? Number(dealer.remainingCreditLimit || 0) : 0;
  const grandTotal = summary.grandTotal || 0;
  const isCreditExceeded = grandTotal > remainingCredit;

  // Handle Checkout submission
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('Your cart is empty. Please add items before placing an order.');
      return;
    }

    if (isCreditExceeded) {
      toast.error('Cannot place order: Grand total exceeds your remaining credit limit.');
      return;
    }

    if (!shippingAddress.pincode.match(/^\d{6}$/)) {
      toast.error('Please enter a valid 6-digit PIN code.');
      return;
    }

    setErrorMsg(null);
    try {
      const res = await checkout({
        warehouseId: dealer?.assignedWarehouseId || null,
        shippingAddress: {
          name: shippingAddress.name.trim(),
          phone: shippingAddress.phone.trim(),
          address: shippingAddress.address.trim(),
          city: shippingAddress.city.trim(),
          state: shippingAddress.state.trim(),
          pincode: shippingAddress.pincode.trim(),
        },
        notes: notes.trim() || null,
      }).unwrap();

      if (res?.data?.id) {
        router.push(`/orders/${res.data.id}`);
      } else {
        router.push('/orders');
      }
    } catch (err: any) {
      setErrorMsg(err?.data?.message || 'Failed to place order. Please check stock and credit limit.');
    }
  };

  if (isCartLoading || isProfileLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Loader2 size={24} className="animate-spin text-[#0176D3]" />
        <p className="text-xs">Preparing checkout...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded border border-[#DDDBDA] p-16 text-center shadow-sm space-y-3">
        <ShoppingBag size={48} className="mx-auto text-slate-300" />
        <h2 className="text-base font-bold text-[#181818]">Your Cart is Empty</h2>
        <p className="text-xs text-[#706E6B]">Please add items to your cart before proceeding to checkout.</p>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0176D3] text-white text-xs font-semibold rounded hover:bg-[#014486] transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded border border-[#DDDBDA] shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/cart"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition-colors"
            title="Back to Cart"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[#181818]">Wholesale Checkout</h1>
            <p className="text-xs text-[#706E6B]">Confirm shipping details and review credit terms</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded bg-[#FDF3F2] border border-[#F8D7DA] text-xs text-[#BA0517] flex items-center gap-2">
          <ShieldAlert size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT 2 COLS: SHIPPING DETAILS & READONLY CART ITEMS */}
          <div className="lg:col-span-2 space-y-4">
            {/* Shipping Address Card */}
            <div className="bg-white rounded border border-[#DDDBDA] p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#DDDBDA]">
                <MapPin size={16} className="text-[#0176D3]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
                  Shipping / Delivery Address
                </h3>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#181818] mb-1">
                      Recipient / Company Name <span className="text-[#BA0517]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.name}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#181818] mb-1">
                      Contact Phone <span className="text-[#BA0517]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.phone}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">
                    Street Address <span className="text-[#BA0517]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={shippingAddress.address}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#181818] mb-1">
                      City <span className="text-[#BA0517]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#181818] mb-1">
                      State <span className="text-[#BA0517]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.state}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#181818] mb-1">
                      PIN Code (6 digits) <span className="text-[#BA0517]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      pattern="^\d{6}$"
                      maxLength={6}
                      value={shippingAddress.pincode}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, pincode: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">
                    Order Notes / Delivery Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Please deliver to back dock entrance before 5 PM."
                    className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                  />
                </div>
              </div>
            </div>

            {/* Warehouse Assignment & Items Preview Card */}
            <div className="bg-white rounded border border-[#DDDBDA] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#DDDBDA]">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-[#0176D3]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
                    Order Items ({items.length})
                  </h3>
                </div>
                <div className="text-[11px] text-slate-500">
                  Fulfillment Hub:{' '}
                  <strong className="text-slate-800">
                    {dealer?.assignedWarehouse?.name || 'Primary Hub'} ({dealer?.assignedWarehouse?.code || 'WH-MUM-01'})
                  </strong>
                </div>
              </div>

              <div className="divide-y divide-[#DDDBDA] border border-[#DDDBDA] rounded overflow-hidden">
                {items.map((it) => (
                  <div key={it.id} className="p-3 flex items-center justify-between bg-white text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                        {it.productImages && it.productImages[0] ? (
                          <img src={it.productImages[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package size={16} className="text-slate-300" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{it.productName}</div>
                        <div className="text-[11px] text-slate-500">
                          {it.variantName} &bull; Qty: <strong className="text-slate-800">{it.quantity}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{formatCurrency(it.lineTotal)}</div>
                      <div className="text-[10px] text-slate-400">
                        {formatCurrency(it.unitPrice)} each
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT 1 COL: CREDIT CHECK & SUBMIT PANEL */}
          <div className="space-y-4">
            {/* Credit Check Card */}
            <div className="bg-white rounded border border-[#DDDBDA] p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#DDDBDA]">
                <CreditCard size={16} className="text-[#0176D3]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#181818]">
                  Dealer Credit Check
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Credit Limit:</span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(dealer?.creditLimit || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Available Credit:</span>
                  <span className="font-bold text-[#2E844A]">
                    {formatCurrency(remainingCredit)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Order Grand Total:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1 border-t">
                  <span>Credit After Order:</span>
                  <span
                    className={`font-bold ${
                      isCreditExceeded ? 'text-[#BA0517]' : 'text-slate-800'
                    }`}
                  >
                    {formatCurrency(remainingCredit - grandTotal)}
                  </span>
                </div>
              </div>

              {/* Credit Warning if Exceeded */}
              {isCreditExceeded ? (
                <div className="p-3 rounded bg-[#FDF3F2] border border-[#F8D7DA] text-xs text-[#BA0517] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={15} />
                    <span>Insufficient Credit Limit</span>
                  </div>
                  <p className="text-[11px] text-slate-700">
                    Your order total of {formatCurrency(grandTotal)} exceeds your available credit limit of{' '}
                    {formatCurrency(remainingCredit)}.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 rounded bg-[#EBF5EE] border border-[#C3E6CD] text-xs text-[#2E844A] flex items-center gap-2">
                  <CheckCircle size={15} className="shrink-0" />
                  <span>Credit limit check passed. Payment due in {dealer?.creditDays || 30} days.</span>
                </div>
              )}
            </div>

            {/* Price Breakdown & Place Order */}
            <div className="bg-white rounded border border-[#DDDBDA] p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#706E6B] border-b pb-2">
                Payment Summary
              </h3>

              <div className="text-xs space-y-2.5">
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Subtotal</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(summary.subtotal)}</span>
                </div>
                {summary.totalDiscount > 0 && (
                  <div className="flex justify-between text-[#2E844A]">
                    <span>Dealer Discount</span>
                    <span className="font-semibold">-{formatCurrency(summary.totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Total GST</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(summary.totalGST)}</span>
                </div>
                <div className="border-t border-[#DDDBDA] pt-3 flex justify-between items-baseline">
                  <span className="font-bold text-sm text-[#181818]">Grand Total</span>
                  <span className="font-extrabold text-xl text-[#0176D3]">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreditExceeded || isSubmitting || items.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-bold rounded transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Placing Order...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Place Order</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div className="text-[10px] text-slate-400 text-center leading-relaxed">
                By placing this order, you agree to the payment credit terms of {dealer?.creditDays || 30} days.
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
