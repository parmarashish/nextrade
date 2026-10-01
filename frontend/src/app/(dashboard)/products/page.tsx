'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import {
  Package,
  Plus,
  Search,
  Filter,
  X,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  ExternalLink,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';
import { RootState } from '@/store';
import { formatCurrency } from '@/lib/utils';
import {
  useGetProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  ProductListItem,
  CreateProductInput,
} from '@/features/products/productsApi';
import { useGetCategoryFlatQuery } from '@/features/categories/categoriesApi';
import { useGetBrandsQuery } from '@/features/products/brandsApi';

import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/ui/data-pagination';
export default function ProductsPage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === 'ADMIN';

  // Filters state
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'true' | 'false'>('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  // Any filter change returns to the first page
  useEffect(() => {
    setPage(1);
  }, [search, categoryId, brandId, statusFilter]);

  // Queries
  const { data: productsData, isLoading: isProductsLoading } = useGetProductsQuery({
    search: search.trim() || undefined,
    categoryId: categoryId || undefined,
    brandId: brandId || undefined,
    isActive: statusFilter === 'ALL' ? undefined : statusFilter,
    page,
    limit,
  });

  const { data: categoriesData } = useGetCategoryFlatQuery({ level: 3 });
  const level3Categories = categoriesData?.data || [];

  const { data: brandsData } = useGetBrandsQuery();
  const brands = brandsData?.data || [];

  const products = productsData?.data || [];
  const totalProducts = productsData?.meta?.total ?? products.length;

  const hasActiveFilters = Boolean(search || categoryId || brandId || statusFilter !== 'ALL');

  const handleClearFilters = () => {
    setSearch('');
    setCategoryId('');
    setBrandId('');
    setStatusFilter('ALL');
    setPage(1);
  };

  // Drawer & Modal States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductListItem | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductListItem | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Mutations
  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();

  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form State for Drawer
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    brandId: '',
    description: '',
    isActive: true,
    images: [''],
    // Initial Variant (on create only)
    variantName: 'Standard',
    variantPrice: '',
    variantMrp: '',
    variantCostPrice: '',
    variantGstPercentage: 18,
    variantMinimumQuantity: 1,
    variantPackingDetails: '',
  });

  const handleOpenCreateDrawer = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      categoryId: level3Categories[0]?.id || '',
      brandId: '',
      description: '',
      isActive: true,
      images: [''],
      variantName: 'Standard',
      variantPrice: '',
      variantMrp: '',
      variantCostPrice: '',
      variantGstPercentage: 18,
      variantMinimumQuantity: 1,
      variantPackingDetails: '',
    });
    setDrawerError(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (product: ProductListItem) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      categoryId: product.category.id,
      brandId: product.brand?.id || '',
      description: product.description || '',
      isActive: product.isActive,
      images: product.images && product.images.length > 0 ? [...product.images] : [''],
      variantName: '',
      variantPrice: '',
      variantMrp: '',
      variantCostPrice: '',
      variantGstPercentage: 18,
      variantMinimumQuantity: 1,
      variantPackingDetails: '',
    });
    setDrawerError(null);
    setIsDrawerOpen(true);
    setActiveActionMenuId(null);
  };

  const handleAddImageUrl = () => {
    if (formData.images.length < 5) {
      setFormData((prev) => ({ ...prev, images: [...prev.images, ''] }));
    }
  };

  const handleRemoveImageUrl = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleImageUrlChange = (index: number, val: string) => {
    setFormData((prev) => {
      const nextImages = [...prev.images];
      nextImages[index] = val;
      return { ...prev, images: nextImages };
    });
  };

  const handleSubmitDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrawerError(null);

    if (!formData.name.trim()) {
      setDrawerError('Product name is required.');
      return;
    }
    if (!formData.categoryId) {
      setDrawerError('Please select a Level 3 Category.');
      return;
    }

    const cleanImages = formData.images
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    try {
      if (editingProduct) {
        await updateProduct({
          id: editingProduct.id,
          name: formData.name.trim(),
          categoryId: formData.categoryId,
          brandId: formData.brandId || null,
          description: formData.description.trim() || null,
          images: cleanImages,
          isActive: formData.isActive,
        }).unwrap();
      } else {
        if (!formData.variantPrice || Number(formData.variantPrice) <= 0) {
          setDrawerError('Initial variant price must be greater than 0.');
          return;
        }

        const initialVariant = {
          name: formData.variantName.trim() || 'Standard',
          price: Number(formData.variantPrice),
          mrp: formData.variantMrp ? Number(formData.variantMrp) : null,
          costPrice: formData.variantCostPrice ? Number(formData.variantCostPrice) : null,
          gstPercentage: Number(formData.variantGstPercentage) || 18,
          minimumQuantity: Number(formData.variantMinimumQuantity) || 1,
          packingDetails: formData.variantPackingDetails.trim() || null,
          isActive: true,
        };

        await createProduct({
          name: formData.name.trim(),
          categoryId: formData.categoryId,
          brandId: formData.brandId || null,
          description: formData.description.trim() || null,
          images: cleanImages,
          isActive: formData.isActive,
          variants: [initialVariant],
        }).unwrap();
      }

      setIsDrawerOpen(false);
    } catch (err: any) {
      setDrawerError(
        err?.data?.message || err?.message || 'Operation failed. Please verify your inputs.'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setDeleteError(null);
    try {
      await deleteProduct(productToDelete.id).unwrap();
      setProductToDelete(null);
    } catch (err: any) {
      setDeleteError(
        err?.data?.message || err?.message || 'Unable to delete product. It may have orders or stock.'
      );
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* ─── TOP BAR ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#181818] tracking-tight">
            Products{' '}
            <span className="text-sm font-normal text-[#706E6B]">
              ({isProductsLoading ? '...' : totalProducts})
            </span>
          </h1>
          <p className="text-xs text-[#706E6B] mt-0.5">
            {isAdmin
              ? "Manage catalogue items, pricing, multi-warehouse inventory, and variant specifications"
              : "Browse the catalogue with your dealer pricing and live stock availability"}
          </p>
        </div>

        {/* Add Product Button (Admin only) */}
        {isAdmin && (
          <button
            onClick={handleOpenCreateDrawer}
            className="h-9 px-4 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>Add Product</span>
          </button>
        )}
      </div>

      {/* ─── FILTERS TOOLBAR ────────────────────────────────────────── */}
      <div className="bg-white p-3.5 rounded border border-[#DDDBDA] shadow-2xs flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] sm:min-w-[260px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#706E6B]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or SKU..."
            className="w-full h-8 pl-9 pr-8 rounded border border-[#DDDBDA] text-xs text-[#181818] placeholder-[#A09E9B] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category Filter (Level 3 only) */}
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="h-8 px-3 rounded border border-[#DDDBDA] text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors bg-white min-w-[140px]"
        >
          <option value="">All Categories</option>
          {level3Categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Brand Filter */}
        <select
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value);
            setPage(1);
          }}
          className="h-8 px-3 rounded border border-[#DDDBDA] text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors bg-white min-w-[120px]"
        >
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as any);
            setPage(1);
          }}
          className="h-8 px-3 rounded border border-[#DDDBDA] text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors bg-white min-w-[110px]"
        >
          <option value="ALL">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="h-8 px-2.5 rounded border border-slate-300 text-xs text-[#706E6B] hover:text-[#BA0517] hover:border-red-300 hover:bg-red-50/50 transition-colors flex items-center gap-1.5 ml-auto sm:ml-0"
          >
            <X size={13} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* ─── PRODUCTS TABLE ─────────────────────────────────────────── */}
      <div className="bg-white rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#DDDBDA] bg-slate-50/70 text-[#706E6B] font-semibold">
                <th className="py-3 px-3 w-14 text-center">Image</th>
                <th className="py-3 px-3">Product Name & SKU</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Brand</th>
                <th className="py-3 px-3">Base Price</th>
                <th className="py-3 px-3 text-center">Variants</th>
                <th className="py-3 px-3 text-center">Total Stock</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDDBDA]/60">
              {isProductsLoading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-3 text-center">
                      <div className="w-10 h-10 bg-slate-100 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3.5 bg-slate-100 rounded w-44 mb-1.5" />
                      <div className="h-2.5 bg-slate-100 rounded w-24" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3 bg-slate-100 rounded w-32" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-3 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-4 bg-slate-100 rounded-full w-14 mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-3 bg-slate-100 rounded w-12 mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-4 bg-slate-100 rounded-full w-16 mx-auto" />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="h-6 bg-slate-100 rounded w-8 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Package size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-[#706E6B]">No products found</p>
                    {hasActiveFilters && (
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
                products.map((product) => {
                  const firstImage = product.images?.[0];
                  const isStockLow = product.hasLowStock || product.totalStock === 0;

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Image Thumbnail (40x40px) */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="w-10 h-10 rounded border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 mx-auto">
                          {firstImage ? (
                            <img
                              src={firstImage}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Package size={18} className="text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Name + SKU Stacked */}
                      <td className="py-2.5 px-3">
                        <Link
                          href={`/products/${product.id}`}
                          className="font-bold text-[#181818] hover:text-[#0176D3] hover:underline block leading-snug"
                        >
                          {product.name}
                        </Link>
                        <span className="text-[11px] font-mono text-[#706E6B] block mt-0.5">
                          {product.sku}
                        </span>
                      </td>

                      {/* Category Breadcrumb (L1 > L3) */}
                      <td className="py-2.5 px-3 text-[#444444] max-w-[180px] truncate" title={product.categoryBreadcrumb}>
                        {product.categoryBreadcrumb || product.category.name}
                      </td>

                      {/* Brand */}
                      <td className="py-2.5 px-3 text-[#181818] font-medium">
                        {product.brand?.name || '—'}
                      </td>

                      {/* Base Price */}
                      <td className="py-2.5 px-3 font-semibold text-[#181818]">
                        {formatCurrency(product.priceRange?.min || 0)}
                      </td>

                      {/* Variants Count */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {product.variantCount} {product.variantCount === 1 ? 'var' : 'vars'}
                        </span>
                      </td>

                      {/* Total Stock */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`font-bold inline-flex items-center gap-1 ${
                            isStockLow ? 'text-[#BA0517]' : 'text-[#2E844A]'
                          }`}
                        >
                          {isStockLow && <AlertTriangle size={12} className="shrink-0" />}
                          {product.totalStock}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            product.isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="relative inline-block text-left">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/products/${product.id}`}
                              title="View Details"
                              className="p-1 rounded text-slate-500 hover:text-[#0176D3] hover:bg-slate-100 transition-colors"
                            >
                              <Eye size={14} />
                            </Link>

                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  title="Edit Product"
                                  onClick={() => handleOpenEditDrawer(product)}
                                  className="p-1 rounded text-slate-500 hover:text-[#0176D3] hover:bg-slate-100 transition-colors"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  title="Delete Product"
                                  onClick={() => {
                                    setProductToDelete(product);
                                    setDeleteError(null);
                                  }}
                                  className="p-1 rounded text-slate-500 hover:text-[#BA0517] hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <DataPagination
          currentPage={page}
          totalPages={productsData?.meta?.totalPages ?? 1}
          totalItems={totalProducts}
          itemsPerPage={limit}
          onPageChange={setPage}
          onItemsPerPageChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </div>

      {/* ─── ADD / EDIT PRODUCT DRAWER (560px) ───────────────────────── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-[560px] bg-white shadow-2xl flex flex-col justify-between border-l border-[#DDDBDA] animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="p-5 border-b border-[#DDDBDA] flex items-center justify-between bg-slate-50/80">
                <div>
                  <h2 className="text-base font-bold text-[#181818]">
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  <p className="text-xs text-[#706E6B] mt-0.5">
                    {editingProduct
                      ? `Editing ${editingProduct.sku} specifications`
                      : 'Define master product details, category, and initial variant'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded text-[#706E6B] hover:text-[#181818] hover:bg-slate-200/60 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Body Form */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {drawerError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-[#BA0517] flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{drawerError}</span>
                  </div>
                )}

                <form id="product-form" onSubmit={handleSubmitDrawer} className="space-y-6">
                  {/* Section 1: Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0176D3] pb-1 border-b border-slate-100">
                      1. Basic Info
                    </h3>

                    <div>
                      <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                        Product Name <span className="text-[#BA0517]">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Industrial Hex Head Bolt"
                        className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                          Category (Level 3) <span className="text-[#BA0517]">*</span>
                        </label>
                        <select
                          required
                          value={formData.categoryId}
                          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                          className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors bg-white"
                        >
                          <option value="">Select Level 3 Category</option>
                          {level3Categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                          Brand (Optional)
                        </label>
                        <select
                          value={formData.brandId}
                          onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                          className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors bg-white"
                        >
                          <option value="">No Brand (Generic)</option>
                          {brands.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detailed technical specifications, material grade, and applications..."
                        className="w-full rounded border border-[#DDDBDA] p-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                      />
                    </div>

                    <div className="pt-1">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#181818]">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="rounded border-[#DDDBDA] text-[#0176D3] focus:ring-[#0176D3] w-4 h-4 cursor-pointer"
                        />
                        <span>Active Product (Visible to Dealers)</span>
                      </label>
                    </div>
                  </div>

                  {/* Section 2: Product Images */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0176D3]">
                        2. Images (Max 5)
                      </h3>
                      {formData.images.length < 5 && (
                        <button
                          type="button"
                          onClick={handleAddImageUrl}
                          className="text-[11px] font-semibold text-[#0176D3] hover:underline flex items-center gap-1"
                        >
                          <Plus size={13} />
                          <span>Add URL</span>
                        </button>
                      )}
                    </div>

                    {formData.images.map((imgUrl, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="url"
                            value={imgUrl}
                            onChange={(e) => handleImageUrlChange(i, e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            className="w-full h-8 pl-3 pr-8 rounded border border-[#DDDBDA] text-xs text-[#181818] placeholder-[#A09E9B] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                          />
                        </div>

                        {/* Thumbnail preview */}
                        <div className="w-8 h-8 rounded border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                          {imgUrl.trim() ? (
                            <img
                              src={imgUrl}
                              alt="preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <ImageIcon size={14} className="text-slate-300" />
                          )}
                        </div>

                        {formData.images.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveImageUrl(i)}
                            className="p-1 rounded text-slate-400 hover:text-[#BA0517] hover:bg-rose-50"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Section 3: Initial Variant (Only on Create) */}
                  {!editingProduct && (
                    <div className="space-y-4 pt-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0176D3] pb-1 border-b border-slate-100">
                        3. Initial Variant
                      </h3>

                      <div>
                        <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                          Variant Name <span className="text-[#BA0517]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.variantName}
                          onChange={(e) => setFormData({ ...formData, variantName: e.target.value })}
                          placeholder="e.g. 50mm / Zinc Plated"
                          className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                            Wholesale Price (₹) <span className="text-[#BA0517]">*</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={formData.variantPrice}
                            onChange={(e) => setFormData({ ...formData, variantPrice: e.target.value })}
                            placeholder="120.00"
                            className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                            MRP (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.variantMrp}
                            onChange={(e) => setFormData({ ...formData, variantMrp: e.target.value })}
                            placeholder="150.00"
                            className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                            Cost Price (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.variantCostPrice}
                            onChange={(e) => setFormData({ ...formData, variantCostPrice: e.target.value })}
                            placeholder="90.00"
                            className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                            GST Percentage (%)
                          </label>
                          <input
                            type="number"
                            value={formData.variantGstPercentage}
                            onChange={(e) => setFormData({ ...formData, variantGstPercentage: parseInt(e.target.value) || 18 })}
                            className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                            Min Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formData.variantMinimumQuantity}
                            onChange={(e) => setFormData({ ...formData, variantMinimumQuantity: parseInt(e.target.value) || 1 })}
                            className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-sm text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                          Packing Details
                        </label>
                        <input
                          type="text"
                          value={formData.variantPackingDetails}
                          onChange={(e) => setFormData({ ...formData, variantPackingDetails: e.target.value })}
                          placeholder="e.g. Box of 100 pcs"
                          className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}
                </form>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-[#DDDBDA] bg-slate-50 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="h-9 px-4 rounded border border-[#DDDBDA] hover:bg-slate-100 text-xs font-semibold text-[#444444] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="product-form"
                  disabled={isCreating || isUpdating}
                  className="h-9 px-5 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  {(isCreating || isUpdating) ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingProduct ? 'Save Changes' : 'Create Product'}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE PRODUCT CONFIRMATION MODAL ───────────────────────── */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#DDDBDA] shadow-xl max-w-md w-full p-5 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-[#BA0517]" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-[#181818]">
                  Delete Product
                </h3>
                <p className="text-xs text-[#706E6B] mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-[#181818]">&quot;{productToDelete.name}&quot;</strong> ({productToDelete.sku})?
                  This action will permanently delete the product and its variants.
                </p>

                {deleteError && (
                  <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-[#BA0517] flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{deleteError}</span>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      setProductToDelete(null);
                      setDeleteError(null);
                    }}
                    className="h-8 px-3 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#444444] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="h-8 px-4 rounded bg-[#BA0517] hover:bg-rose-800 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isDeleting ? (
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
