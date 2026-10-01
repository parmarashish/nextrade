'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Plus, Edit2, Trash2, X, Loader2, Package, Search } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';
import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/ui/data-pagination';
import { toast } from '@/components/ui/toast';
import {
  Brand,
  useGetAllBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
} from '@/features/products/brandsApi';

const EMPTY_FORM = { name: '', logo: '', description: '', isActive: true };

export default function BrandsPage() {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/orders');
  }, [user, router]);

  const { data, isLoading } = useGetAllBrandsQuery();
  const [createBrand, { isLoading: creating }] = useCreateBrandMutation();
  const [updateBrand, { isLoading: updating }] = useUpdateBrandMutation();
  const [deleteBrand, { isLoading: deleting }] = useDeleteBrandMutation();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [nameError, setNameError] = useState('');
  const [toDelete, setToDelete] = useState<Brand | null>(null);

  const filteredBrands = (data?.data || []).filter((b) => b.name.toLowerCase().includes(search.trim().toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / limit));
  const brands = filteredBrands.slice((page - 1) * limit, page * limit);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const openForm = (brand?: Brand) => {
    setEditing(brand || null);
    setForm(
      brand
        ? { name: brand.name, logo: brand.logo || '', description: brand.description || '', isActive: brand.isActive }
        : EMPTY_FORM
    );
    setNameError('');
    setIsOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      setNameError('Brand name must be at least 2 characters');
      return;
    }
    const body = {
      name: form.name.trim(),
      logo: form.logo.trim() || null,
      description: form.description.trim() || null,
      isActive: form.isActive,
    };
    try {
      if (editing) await updateBrand({ id: editing.id, ...body }).unwrap();
      else await createBrand(body).unwrap();
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to save brand');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteBrand(toDelete.id).unwrap();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to delete brand');
    } finally {
      setToDelete(null);
    }
  };

  const inputCls =
    'w-full h-9 px-3 text-sm border border-[#DDDBDA] rounded bg-white focus:outline-none focus:border-[#0176D3] focus:ring-2 focus:ring-[#0176D3]/20';

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded border border-[#DDDBDA] shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center">
            <Bookmark className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#181818] flex items-center gap-2">
              Brands
              <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {data?.data?.length ?? 0}
              </span>
            </h1>
            <p className="text-xs text-[#706E6B]">Manufacturers and labels used to organise the product catalogue</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#706E6B]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brands…"
              aria-label="Search brands"
              className={cn(inputCls, 'pl-8')}
            />
          </div>
        <button
          onClick={() => openForm()}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-[#0176D3] hover:bg-[#014486] text-white text-sm font-medium rounded transition-colors"
        >
          <Plus size={15} /> Add Brand
        </button>
        </div>
      </div>

      <div className="bg-white rounded border border-[#DDDBDA] shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-[#706E6B] text-left">
              <th className="py-2.5 px-4 font-semibold">Brand</th>
              <th className="py-2.5 px-4 font-semibold">Description</th>
              <th className="py-2.5 px-4 font-semibold">Products</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
              <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECEBE9]">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={5} className="py-4 px-4">
                    <div className="h-4 bg-slate-100 rounded w-1/2" />
                  </td>
                </tr>
              ))}
            {!isLoading && brands.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[#706E6B]">
                  <Bookmark className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  {search ? 'No brands match your search' : 'No brands yet — add your first brand'}
                </td>
              </tr>
            )}
            {brands.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-semibold text-[#181818]">{b.name}</div>
                  <div className="font-mono text-[10px] text-slate-400">{b.slug}</div>
                </td>
                <td className="py-3 px-4 text-[#706E6B] max-w-xs truncate">{b.description || '—'}</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                    <Package size={12} className="text-slate-400" />
                    {b._count?.products ?? 0}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[11px] font-semibold',
                      b.isActive ? 'bg-[#EBF7E6] text-[#2E844A]' : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {b.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <button
                    onClick={() => openForm(b)}
                    aria-label={`Edit ${b.name}`}
                    title="Edit brand"
                    className="p-1.5 rounded text-slate-500 hover:text-[#0176D3] hover:bg-[#EAF5FE]"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setToDelete(b)}
                    aria-label={`Delete ${b.name}`}
                    title="Delete brand"
                    className="p-1.5 rounded text-slate-500 hover:text-[#BA0517] hover:bg-[#FDF3F2]"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <DataPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filteredBrands.length}
          itemsPerPage={limit}
          onPageChange={setPage}
          onItemsPerPageChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-white rounded border border-[#DDDBDA] shadow-xl max-w-[480px] w-full p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDDBDA] mb-4">
              <h3 className="text-base font-bold text-[#181818]">{editing ? 'Edit Brand' : 'Add New Brand'}</h3>
              <button type="button" aria-label="Close" onClick={() => setIsOpen(false)} className="p-1 rounded text-[#706E6B] hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    setNameError('');
                  }}
                  className={cn(inputCls, nameError && 'border-[#BA0517]')}
                />
                {nameError && <p className="text-[11px] text-[#BA0517] mt-1">{nameError}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Logo URL</label>
                <input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="https://…" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={cn(inputCls, 'h-auto py-2')}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-[#DDDBDA] text-[#0176D3]"
                />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-[#DDDBDA]">
              <button type="button" onClick={() => setIsOpen(false)} className="h-9 px-4 text-sm font-medium border border-[#DDDBDA] rounded hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || updating}
                className="h-9 px-4 text-sm font-medium bg-[#0176D3] hover:bg-[#014486] text-white rounded inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {(creating || updating) && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Save Changes' : 'Create Brand'}
              </button>
            </div>
          </form>
        </div>
      )}

      {toDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#DDDBDA] shadow-xl max-w-[420px] w-full p-5">
            <h3 className="text-base font-bold text-[#181818] mb-2">Delete brand?</h3>
            <p className="text-sm text-[#706E6B]">
              <strong>{toDelete.name}</strong> will be permanently removed.
              {(toDelete._count?.products ?? 0) > 0 && (
                <span className="block mt-2 text-[#BA0517]">
                  This brand has {toDelete._count?.products} linked products, so deletion will be blocked.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setToDelete(null)} className="h-9 px-4 text-sm font-medium border border-[#DDDBDA] rounded hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="h-9 px-4 text-sm font-medium bg-[#BA0517] hover:bg-[#8E0412] text-white rounded inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
