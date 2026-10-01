'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import {
  ArrowLeft,
  Package,
  Edit2,
  Trash2,
  Plus,
  Boxes,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  Building2,
  Tag,
  ShoppingCart,
} from 'lucide-react';
import { RootState } from '@/store';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  useGetProductByIdQuery,
  useDeleteProductMutation,
  useAddVariantMutation,
  useUpdateVariantMutation,
  useDeleteVariantMutation,
  ProductVariantDetail,
  CreateVariantInput,
} from '@/features/products/productsApi';
import { useAddToCartMutation } from '@/features/orders/ordersApi';
import { toast } from '@/components/ui/toast';

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;
  const router = useRouter();

  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === 'ADMIN';
  const isDealer = user?.role === 'DEALER';

  // Fetch product detail
  const { data, isLoading, error } = useGetProductByIdQuery(productId);
  const product = data?.data;

  // Mutations
  const [deleteProduct, { isLoading: isDeletingProduct }] = useDeleteProductMutation();
  const [addVariant, { isLoading: isAddingVariant }] = useAddVariantMutation();
  const [updateVariant, { isLoading: isUpdatingVariant }] = useUpdateVariantMutation();
  const [deleteVariant, { isLoading: isDeletingVariant }] = useDeleteVariantMutation();
  const [addToCart] = useAddToCartMutation();

  const [addingVariantId, setAddingVariantId] = useState<string | null>(null);

  // Active main image in gallery
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Variant Modal State
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariantDetail | null>(null);
  const [variantFormData, setVariantFormData] = useState<CreateVariantInput>({
    name: '',
    price: 0,
    mrp: null,
    costPrice: null,
    gstPercentage: 18,
    minimumQuantity: 1,
    packingDetails: '',
    isActive: true,
  });
  const [variantModalError, setVariantModalError] = useState<string | null>(null);

  // Delete Variant Confirmation
  const [variantToDelete, setVariantToDelete] = useState<ProductVariantDetail | null>(null);
  const [deleteVariantError, setDeleteVariantError] = useState<string | null>(null);

  // Delete Product Confirmation
  const [isDeleteProductModalOpen, setIsDeleteProductModalOpen] = useState(false);
  const [deleteProductError, setDeleteProductError] = useState<string | null>(null);

  const handleOpenAddVariant = () => {
    setEditingVariant(null);
    setVariantFormData({
      name: '',
      price: 0,
      mrp: null,
      costPrice: null,
      gstPercentage: 18,
      minimumQuantity: 1,
      packingDetails: '',
      isActive: true,
    });
    setVariantModalError(null);
    setIsVariantModalOpen(true);
  };

  const handleOpenEditVariant = (variant: ProductVariantDetail) => {
    setEditingVariant(variant);
    setVariantFormData({
      name: variant.name,
      price: variant.price,
      mrp: variant.mrp,
      costPrice: variant.costPrice || null,
      gstPercentage: variant.gstPercentage,
      minimumQuantity: variant.minimumQuantity,
      packingDetails: variant.packingDetails || '',
      isActive: variant.isActive,
    });
    setVariantModalError(null);
    setIsVariantModalOpen(true);
  };

  const handleSubmitVariantForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setVariantModalError(null);

    if (!variantFormData.name.trim()) {
      setVariantModalError('Variant name is required.');
      return;
    }
    if (!variantFormData.price || Number(variantFormData.price) <= 0) {
      setVariantModalError('Price must be greater than 0.');
      return;
    }

    try {
      if (editingVariant) {
        await updateVariant({
          productId,
          variantId: editingVariant.id,
          name: variantFormData.name.trim(),
          price: Number(variantFormData.price),
          mrp: variantFormData.mrp ? Number(variantFormData.mrp) : null,
          costPrice: variantFormData.costPrice ? Number(variantFormData.costPrice) : null,
          gstPercentage: Number(variantFormData.gstPercentage) || 18,
          minimumQuantity: Number(variantFormData.minimumQuantity) || 1,
          packingDetails: variantFormData.packingDetails?.trim() || null,
          isActive: variantFormData.isActive,
        }).unwrap();
      } else {
        await addVariant({
          productId,
          body: {
            name: variantFormData.name.trim(),
            price: Number(variantFormData.price),
            mrp: variantFormData.mrp ? Number(variantFormData.mrp) : null,
            costPrice: variantFormData.costPrice ? Number(variantFormData.costPrice) : null,
            gstPercentage: Number(variantFormData.gstPercentage) || 18,
            minimumQuantity: Number(variantFormData.minimumQuantity) || 1,
            packingDetails: variantFormData.packingDetails?.trim() || null,
            isActive: variantFormData.isActive,
          },
        }).unwrap();
      }

      setIsVariantModalOpen(false);
    } catch (err: any) {
      setVariantModalError(
        err?.data?.message || err?.message || 'Failed to save variant specifications.'
      );
    }
  };

  const handleConfirmDeleteVariant = async () => {
    if (!variantToDelete) return;
    setDeleteVariantError(null);

    try {
      await deleteVariant({
        productId,
        variantId: variantToDelete.id,
      }).unwrap();
      setVariantToDelete(null);
    } catch (err: any) {
      setDeleteVariantError(
        err?.data?.message || err?.message || 'Cannot delete variant. It may be part of an order or have warehouse stock.'
      );
    }
  };

  const handleConfirmDeleteProduct = async () => {
    setDeleteProductError(null);
    try {
      await deleteProduct(productId).unwrap();
      router.push('/products');
    } catch (err: any) {
      setDeleteProductError(
        err?.data?.message || err?.message || 'Failed to delete product.'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 size={32} className="animate-spin text-[#0176D3]" />
        <p className="text-xs text-[#706E6B]">Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-white rounded border border-[#DDDBDA] p-10 text-center max-w-lg mx-auto">
        <AlertCircle size={36} className="text-[#BA0517] mx-auto mb-2" />
        <h2 className="text-base font-bold text-[#181818]">Product Not Found</h2>
        <p className="text-xs text-[#706E6B] mt-1">
          The requested product does not exist or may have been deleted.
        </p>
        <Link
          href="/products"
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] text-white text-xs font-semibold rounded"
        >
          <ArrowLeft size={14} />
          <span>Return to Products</span>
        </Link>
      </div>
    );
  }

  const images = product.images && product.images.length > 0 ? product.images : [];
  const mainImage = images[selectedImageIndex] || images[0];

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Breadcrumb & Back Link ──────────────────────────────────── */}
      <div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs text-[#706E6B] hover:text-[#0176D3] font-medium transition-colors mb-2"
        >
          <ArrowLeft size={13} />
          <span>Back to Products</span>
        </Link>
      </div>

      {/* ─── Product Header ─────────────────────────────────────────── */}
      <div className="bg-white rounded border border-[#DDDBDA] p-5 shadow-[0_2px_4px_rgba(0,0,0,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-mono text-xs font-bold text-[#0176D3] bg-[#EAF5FE] px-2 py-0.5 rounded border border-[#D4E7F9]">
              {product.sku}
            </span>
            <span className="text-xs text-[#706E6B]">
              {product.category?.name}
            </span>
            {product.brand && (
              <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-semibold">
                {product.brand.name}
              </span>
            )}
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                product.isActive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {product.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#181818] tracking-tight">
            {product.name}
          </h1>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsDeleteProductModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-rose-200 hover:bg-rose-50 text-xs font-semibold text-[#BA0517] transition-colors"
            >
              <Trash2 size={13} />
              <span>Delete Product</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── Gallery & Product Info Panel ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gallery (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded border border-[#DDDBDA] p-5 shadow-[0_2px_4px_rgba(0,0,0,0.08)] space-y-3">
          <div className="w-full h-64 rounded bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
            {mainImage ? (
              <img
                src={mainImage}
                alt={product.name}
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-300 gap-1.5">
                <Package size={48} />
                <span className="text-xs text-slate-400">No Image Available</span>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {images.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-14 h-14 rounded border overflow-hidden shrink-0 transition-all ${
                    selectedImageIndex === idx
                      ? 'border-[#0176D3] ring-2 ring-[#0176D3]/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img src={url} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded border border-[#DDDBDA] p-5 shadow-[0_2px_4px_rgba(0,0,0,0.08)] space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#706E6B] mb-1.5">
              Description
            </h3>
            <p className="text-xs text-[#444444] bg-slate-50 rounded p-3 border border-slate-200/60 leading-relaxed">
              {product.description || 'No detailed description provided.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 bg-slate-50 rounded border border-slate-200/60">
              <span className="text-[11px] text-[#706E6B] block">Category</span>
              <span className="text-xs font-semibold text-[#181818] block mt-0.5">
                {product.category?.name}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200/60">
              <span className="text-[11px] text-[#706E6B] block">Brand</span>
              <span className="text-xs font-semibold text-[#181818] block mt-0.5">
                {product.brand?.name || 'Generic / Non-branded'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200/60">
              <span className="text-[11px] text-[#706E6B] block">Created On</span>
              <span className="text-xs font-semibold text-[#181818] block mt-0.5">
                {formatDate(product.createdAt)}
              </span>
            </div>
          </div>

          {/* Dealer Discount Notice if dealer */}
          {isDealer && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded text-xs text-[#014486] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent size={18} className="text-[#0176D3] shrink-0" />
                <div>
                  {product.dealerDiscountPercent > 0 ? (
                    <>
                      <span className="font-bold">Dealer Discount Active: </span>
                      <span>{product.dealerDiscountPercent}% applied to this category</span>
                    </>
                  ) : (
                    <span className="font-bold">Standard wholesale pricing applies to this category</span>
                  )}
                </div>
              </div>
              {product.dealerDiscountPercent > 0 && (
                <span className="text-[11px] font-semibold text-[#0176D3] bg-white px-2 py-0.5 rounded border border-blue-200">
                  Tier Pricing Active
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── DEALER PRICING PANEL (Dealer View Only) ────────────────── */}
      {isDealer && (
        <div className="bg-white rounded border border-blue-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-blue-50/70 border-b border-blue-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#014486] flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-[#0176D3]" />
                Personalized Dealer Pricing
              </h2>
              <p className="text-[11px] text-[#014486]/80 mt-0.5">
                Direct contractual pricing after your {product.dealerDiscountPercent}% category margin
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-blue-100 bg-blue-50/30 text-[#706E6B] font-semibold">
                  <th className="py-2.5 px-4">Variant</th>
                  <th className="py-2.5 px-4">Catalog Wholesale</th>
                  <th className="py-2.5 px-4">Your Margin</th>
                  <th className="py-2.5 px-4 font-bold text-[#0176D3]">Your Effective Price</th>
                  <th className="py-2.5 px-4 text-center">Order Min Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {product.variants.map((v) => (
                  <tr key={v.id} className="hover:bg-blue-50/20">
                    <td className="py-2.5 px-4 font-bold text-[#181818]">{v.name}</td>
                    <td className={`py-2.5 px-4 text-[#706E6B] ${v.dealerDiscountPercent > 0 ? 'line-through' : ''}`}>
                      {formatCurrency(v.price)}
                    </td>
                    <td className="py-2.5 px-4 text-[#2E844A] font-semibold">
                      {v.dealerDiscountPercent > 0 ? `-${v.dealerDiscountPercent}%` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-sm font-bold text-[#0176D3]">
                      {formatCurrency(v.effectivePrice)}
                    </td>
                    <td className="py-2.5 px-4 text-center text-[#706E6B]">
                      {v.minimumQuantity} units
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── VARIANTS SECTION ───────────────────────────────────────── */}
      <div className="bg-white rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="p-4 border-b border-[#DDDBDA] bg-slate-50/70 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#181818]">
              Product Variants ({product.variants.length})
            </h2>
            <p className="text-[11px] text-[#706E6B]">
              Specifications, wholesale catalog prices, GST rates, and available inventory
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={handleOpenAddVariant}
              className="h-8 px-3 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Add Variant</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#DDDBDA] bg-slate-50/40 text-[#706E6B] font-semibold">
                <th className="py-3 px-3">Variant Name</th>
                <th className="py-3 px-3">SKU</th>
                <th className="py-3 px-3">Wholesale Price</th>
                <th className="py-3 px-3">MRP</th>
                {isAdmin && <th className="py-3 px-3">Cost Price</th>}
                <th className="py-3 px-3 text-center">GST%</th>
                <th className="py-3 px-3 text-center">Min Qty</th>
                <th className="py-3 px-3 text-center">Available Stock</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDDBDA]/60">
              {product.variants.map((v) => {
                const avail = v.inventory?.availableQuantity ?? 0;
                const isLow = avail <= 10; // low stock highlight
                const isAdding = addingVariantId === v.id;

                return (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#181818]">
                      {v.name}
                      {v.packingDetails && (
                        <span className="block text-[10px] text-[#706E6B] font-normal">
                          {v.packingDetails}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#706E6B]">
                      {v.sku}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#181818]">
                      {formatCurrency(v.price)}
                    </td>
                    <td className="py-2.5 px-3 text-[#706E6B]">
                      {v.mrp ? formatCurrency(v.mrp) : '—'}
                    </td>
                    {isAdmin && (
                      <td className="py-2.5 px-3 text-[#706E6B]">
                        {v.costPrice ? formatCurrency(v.costPrice) : '—'}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-center text-[#706E6B]">
                      {v.gstPercentage}%
                    </td>
                    <td className="py-2.5 px-3 text-center text-[#706E6B]">
                      {v.minimumQuantity}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`font-bold inline-flex items-center gap-1 ${
                          isLow ? 'text-[#BA0517]' : 'text-[#2E844A]'
                        }`}
                      >
                        {isLow && <AlertTriangle size={12} />}
                        {avail} units
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Edit Variant"
                            onClick={() => handleOpenEditVariant(v)}
                            className="p-1 rounded text-slate-500 hover:text-[#0176D3] hover:bg-slate-100"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            title="Delete Variant"
                            disabled={product.variants.length <= 1}
                            onClick={() => {
                              setVariantToDelete(v);
                              setDeleteVariantError(null);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-[#BA0517] hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isAdding || avail <= 0}
                          onClick={async () => {
                            setAddingVariantId(v.id);
                            try {
                              await addToCart({
                                productVariantId: v.id,
                                quantity: v.minimumQuantity || 1,
                              }).unwrap();
                              toast.success(`Added ${v.name} to cart`);
                            } catch (err: any) {
                              toast.error(err?.data?.message || 'Failed to add to cart');
                            } finally {
                              setAddingVariantId(null);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0176D3] hover:bg-[#014486] text-white rounded text-xs font-semibold shadow-xs disabled:opacity-40 transition-colors"
                        >
                          {isAdding ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <ShoppingCart size={12} />
                          )}
                          <span>{avail <= 0 ? 'Out of Stock' : 'Add to Cart'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── STOCK BY WAREHOUSE PANEL ───────────────────────────────── */}
      <div className="bg-white rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="p-4 border-b border-[#DDDBDA] bg-slate-50/70">
          <h2 className="text-sm font-bold text-[#181818] flex items-center gap-1.5">
            <Boxes size={16} className="text-[#0176D3]" />
            Multi-Warehouse Inventory Summary
          </h2>
          <p className="text-[11px] text-[#706E6B]">
            Live breakdown of physical, reserved, and unallocated stock across regional fulfillment centers
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#DDDBDA] bg-slate-50/40 text-[#706E6B] font-semibold">
                <th className="py-2.5 px-4">Variant</th>
                <th className="py-2.5 px-4">Warehouse</th>
                <th className="py-2.5 px-4 text-center">Available Stock</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDDBDA]/60">
              {product.variants.flatMap((variant) =>
                (variant.inventory?.warehouses || []).map((wh) => {
                  const isHealthy = wh.available > 10;
                  return (
                    <tr key={`${variant.id}-${wh.warehouseId}`} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 font-medium text-[#181818]">
                        {variant.name}
                      </td>
                      <td className="py-2.5 px-4 text-[#444444]">
                        <span className="font-semibold text-[#181818]">{wh.warehouseName}</span>{' '}
                        <span className="font-mono text-[10px] text-[#706E6B]">({wh.warehouseCode})</span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold">
                        <span className={isHealthy ? 'text-[#2E844A]' : 'text-[#BA0517]'}>
                          {wh.available}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isHealthy
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {isHealthy ? 'In Stock' : 'Low Stock'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ADD / EDIT VARIANT MODAL (480px) ───────────────────────── */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#DDDBDA] shadow-xl max-w-[480px] w-full p-5 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDDBDA] mb-4">
              <h3 className="text-base font-bold text-[#181818]">
                {editingVariant ? 'Edit Variant' : 'Add New Variant'}
              </h3>
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                className="p-1 rounded text-[#706E6B] hover:text-[#181818] hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {variantModalError && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-[#BA0517] flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{variantModalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitVariantForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                  Variant Name <span className="text-[#BA0517]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={variantFormData.name}
                  onChange={(e) => setVariantFormData({ ...variantFormData, name: e.target.value })}
                  placeholder="e.g. 50mm / Zinc Plated"
                  className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    Wholesale Price (₹) <span className="text-[#BA0517]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={variantFormData.price || ''}
                    onChange={(e) => setVariantFormData({ ...variantFormData, price: parseFloat(e.target.value) || 0 })}
                    placeholder="120.00"
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={variantFormData.mrp ?? ''}
                    onChange={(e) =>
                      setVariantFormData({
                        ...variantFormData,
                        mrp: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="150.00"
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={variantFormData.costPrice ?? ''}
                    onChange={(e) =>
                      setVariantFormData({
                        ...variantFormData,
                        costPrice: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="90.00"
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    GST Percentage (%)
                  </label>
                  <input
                    type="number"
                    value={variantFormData.gstPercentage ?? 18}
                    onChange={(e) =>
                      setVariantFormData({
                        ...variantFormData,
                        gstPercentage: parseInt(e.target.value) || 18,
                      })
                    }
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    Min Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={variantFormData.minimumQuantity ?? 1}
                    onChange={(e) =>
                      setVariantFormData({
                        ...variantFormData,
                        minimumQuantity: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    Packing Details
                  </label>
                  <input
                    type="text"
                    value={variantFormData.packingDetails || ''}
                    onChange={(e) =>
                      setVariantFormData({ ...variantFormData, packingDetails: e.target.value })
                    }
                    placeholder="e.g. Box of 100 pcs"
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#DDDBDA] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="h-8 px-3 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#444444] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingVariant || isUpdatingVariant}
                  className="h-8 px-4 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  {(isAddingVariant || isUpdatingVariant) ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingVariant ? 'Save Changes' : 'Add Variant'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE VARIANT CONFIRMATION MODAL ───────────────────────── */}
      {variantToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#DDDBDA] shadow-xl max-w-md w-full p-5 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-[#BA0517]" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-[#181818]">
                  Delete Variant
                </h3>
                <p className="text-xs text-[#706E6B] mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-[#181818]">&quot;{variantToDelete.name}&quot;</strong> ({variantToDelete.sku})?
                  This action cannot be undone.
                </p>

                {deleteVariantError && (
                  <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-[#BA0517] flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{deleteVariantError}</span>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isDeletingVariant}
                    onClick={() => {
                      setVariantToDelete(null);
                      setDeleteVariantError(null);
                    }}
                    className="h-8 px-3 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#444444] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingVariant}
                    onClick={handleConfirmDeleteVariant}
                    className="h-8 px-4 rounded bg-[#BA0517] hover:bg-rose-800 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isDeletingVariant ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Delete</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE PRODUCT CONFIRMATION MODAL ───────────────────────── */}
      {isDeleteProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#DDDBDA] shadow-xl max-w-md w-full p-5 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-[#BA0517]" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-[#181818]">
                  Delete Entire Product
                </h3>
                <p className="text-xs text-[#706E6B] mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-[#181818]">&quot;{product.name}&quot;</strong>?
                  All associated variants and data will be removed.
                </p>

                {deleteProductError && (
                  <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-[#BA0517] flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{deleteProductError}</span>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isDeletingProduct}
                    onClick={() => {
                      setIsDeleteProductModalOpen(false);
                      setDeleteProductError(null);
                    }}
                    className="h-8 px-3 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#444444] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingProduct}
                    onClick={handleConfirmDeleteProduct}
                    className="h-8 px-4 rounded bg-[#BA0517] hover:bg-rose-800 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isDeletingProduct ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Delete</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
