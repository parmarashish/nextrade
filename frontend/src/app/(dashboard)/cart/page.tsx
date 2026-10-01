'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Package,
  AlertTriangle,
  Loader2,
  CheckCircle,
  X,
  Building,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { formatCurrency, pluralize } from '@/lib/utils';
import {
  useGetCartQuery,
  useUpdateCartItemMutation,
  useRemoveFromCartMutation,
  useClearCartMutation,
  CartItemProduct,
} from '@/features/orders/ordersApi';
import { useGetDealerProfileQuery } from '@/features/dealers/dealersApi';
import { toast } from '@/components/ui/toast';
import { confirmDialog } from '@/components/ui/confirm-dialog';

export default function CartPage() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'ADMIN';

  // Guard: Admin should redirect to /orders
  useEffect(() => {
    if (isAdmin) {
      router.replace('/orders');
    }
  }, [isAdmin, router]);

  const { data: cartData, isLoading, isFetching } = useGetCartQuery();
  const { data: dealerProfileData } = useGetDealerProfileQuery(undefined, { skip: isAdmin });
  const [updateCartItem, { isLoading: isUpdating }] = useUpdateCartItemMutation();
  const [removeFromCart, { isLoading: isRemoving }] = useRemoveFromCartMutation();
  const [clearCart, { isLoading: isClearing }] = useClearCartMutation();

  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);

  const cart = cartData?.data;
  const items = cart?.items || [];
  const summary = cart?.summary || {
    totalItems: 0,
    subtotal: 0,
    totalDiscount: 0,
    totalGST: 0,
    grandTotal: 0,
  };

  const dealerProfile = dealerProfileData?.data;

  // Handle quantity change
  const handleQuantityChange = async (item: CartItemProduct, newQty: number) => {
    if (newQty < 1) {
      handleRemoveItem(item.id);
      return;
    }
    setLoadingItemId(item.id);
    try {
      await updateCartItem({ itemId: item.id, quantity: newQty }).unwrap();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to update quantity');
    } finally {
      setLoadingItemId(null);
    }
  };

  // Handle remove item
  const handleRemoveItem = async (itemId: string) => {
    if (!(await confirmDialog({ title: 'Remove item?', message: 'This item will be removed from your cart.', confirmLabel: 'Remove', destructive: true }))) return;
    setLoadingItemId(itemId);
    try {
      await removeFromCart(itemId).unwrap();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to remove item');
    } finally {
      setLoadingItemId(null);
    }
  };

  // Handle clear cart
  const handleClearCart = async () => {
    if (!(await confirmDialog({ title: 'Empty cart?', message: 'All items will be removed from your cart.', confirmLabel: 'Empty cart', destructive: true }))) return;
    try {
      await clearCart().unwrap();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to clear cart');
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Loader2 size={24} className="animate-spin text-[#0176D3]" />
        <p className="text-xs">Loading shopping cart...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded border border-[#DDDBDA] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center font-bold">
            <ShoppingCart size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#181818]">Shopping Cart</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {pluralize(summary.totalItems, "item")}
              </span>
            </div>
            <p className="text-xs text-[#706E6B]">Review your items and proceed to wholesale checkout</p>
          </div>
        </div>

        <Link
          href="/products"
          className="text-xs font-semibold text-[#0176D3] hover:underline flex items-center gap-1"
        >
          <Plus size={14} /> Add more products
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded border border-[#DDDBDA] p-16 text-center shadow-sm space-y-3">
          <ShoppingCart size={48} className="mx-auto text-slate-300" />
          <h2 className="text-base font-bold text-[#181818]">Your Cart is Empty</h2>
          <p className="text-xs text-[#706E6B] max-w-sm mx-auto">
            You don't have any products in your cart yet. Explore our wholesale catalog to add items.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold rounded transition-colors shadow-sm mt-2"
          >
            <span>Browse Products</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT 2 COLS: CART ITEMS TABLE */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded border border-[#DDDBDA] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8F9FA] text-[#706E6B] font-semibold uppercase text-[10px] tracking-wider border-b border-[#DDDBDA]">
                      <th className="py-3 px-4">Product & Variant</th>
                      <th className="py-3 px-4 text-right">Price</th>
                      <th className="py-3 px-4 text-center">Quantity</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDDBDA]">
                    {items.map((item) => {
                      const isItemLoading = loadingItemId === item.id;
                      const hasStockWarning =
                        item.availableStock !== null && item.quantity > item.availableStock;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          {/* Product Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded border border-[#DDDBDA] bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                                {item.productImages && item.productImages.length > 0 ? (
                                  <img
                                    src={item.productImages[0]}
                                    alt={item.productName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package size={20} className="text-slate-300" />
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-[#181818]">{item.productName}</div>
                                <div className="text-[11px] text-[#706E6B] flex items-center gap-2 mt-0.5">
                                  <span>{item.variantName}</span>
                                  <span className="font-mono text-slate-400">({item.sku})</span>
                                </div>
                                {item.packingDetails && (
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    Pack: {item.packingDetails}
                                  </div>
                                )}
                                {hasStockWarning && (
                                  <div className="flex items-center gap-1 text-[10px] text-[#BA0517] font-semibold mt-1">
                                    <AlertTriangle size={12} />
                                    <span>Only {item.availableStock} in stock</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Unit Price */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="font-semibold text-slate-900">
                              {formatCurrency(item.unitPrice)}
                            </div>
                            {item.dealerDiscountPercent > 0 && (
                              <div className="text-[10px] text-[#2E844A]">
                                {item.dealerDiscountPercent}% off (was {formatCurrency(item.originalUnitPrice)})
                              </div>
                            )}
                          </td>

                          {/* Quantity Controls */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center border border-[#DDDBDA] rounded bg-white overflow-hidden shadow-2xs">
                              <button
                                onClick={() => handleQuantityChange(item, item.quantity - 1)}
                                disabled={isItemLoading}
                                className="px-2 py-1 hover:bg-slate-100 text-slate-600 disabled:opacity-50 transition-colors"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="px-3 py-1 font-bold text-slate-800 text-xs min-w-8 text-center">
                                {isItemLoading ? (
                                  <Loader2 size={12} className="animate-spin mx-auto text-[#0176D3]" />
                                ) : (
                                  item.quantity
                                )}
                              </span>
                              <button
                                onClick={() => handleQuantityChange(item, item.quantity + 1)}
                                disabled={isItemLoading}
                                className="px-2 py-1 hover:bg-slate-100 text-slate-600 disabled:opacity-50 transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>

                          {/* Line Total */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="font-bold text-[#181818]">
                              {formatCurrency(item.lineTotal)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Taxable: {formatCurrency(item.taxableTotal)} + GST {item.gstPercentage}%
                            </div>
                          </td>

                          {/* Remove Button */}
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={isItemLoading}
                              className="p-1.5 text-slate-400 hover:text-[#BA0517] rounded transition-colors"
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Actions */}
              <div className="p-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-between">
                <button
                  onClick={handleClearCart}
                  disabled={isClearing}
                  className="text-xs text-slate-500 hover:text-[#BA0517] flex items-center gap-1 font-medium transition-colors"
                >
                  <Trash2 size={13} /> Clear Entire Cart
                </button>
                <Link
                  href="/products"
                  className="text-xs font-semibold text-[#0176D3] hover:underline"
                >
                  Continue Shopping →
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT 1 COL: ORDER SUMMARY CARD */}
          <div className="space-y-4">
            <div className="bg-white rounded border border-[#DDDBDA] p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#706E6B] border-b pb-2">
                Order Summary
              </h3>

              <div className="text-xs space-y-2.5">
                <div className="flex justify-between text-slate-600">
                  <span>Total Items</span>
                  <span className="font-semibold text-slate-800">{summary.totalItems === 1 ? "1 unit" : `${summary.totalItems} units`}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Subtotal</span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(summary.subtotal)}
                  </span>
                </div>
                {summary.totalDiscount > 0 && (
                  <div className="flex justify-between text-[#2E844A]">
                    <span>Dealer Discounts</span>
                    <span className="font-semibold">-{formatCurrency(summary.totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Total GST</span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(summary.totalGST)}
                  </span>
                </div>
                <div className="border-t border-[#DDDBDA] pt-3 flex justify-between items-baseline">
                  <span className="font-bold text-sm text-[#181818]">Grand Total</span>
                  <span className="font-extrabold text-lg text-[#0176D3]">
                    {formatCurrency(summary.grandTotal)}
                  </span>
                </div>
              </div>

              {dealerProfile && (
                <div className="p-3 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Available Credit:</span>
                    <span className="font-bold text-[#2E844A]">
                      {formatCurrency(dealerProfile.remainingCreditLimit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Terms:</span>
                    <span className="font-semibold text-slate-800">
                      {dealerProfile.creditDays || 30} Days Credit
                    </span>
                  </div>
                </div>
              )}

              <Link
                href="/checkout"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-bold rounded transition-colors shadow-sm"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight size={15} />
              </Link>

              <p className="text-[10px] text-slate-400 text-center">
                Inventory is reserved immediately upon order confirmation.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
