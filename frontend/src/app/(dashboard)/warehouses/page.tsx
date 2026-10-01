'use client';

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Warehouse as WarehouseIcon,
  Plus,
  MapPin,
  Phone,
  User,
  Boxes,
  Package,
  TrendingUp,
  AlertTriangle,
  Edit2,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building,
  ShieldCheck,
} from 'lucide-react';
import { RootState } from '@/store';
import { formatCurrency } from '@/lib/utils';
import {
  useGetWarehousesQuery,
  useGetWarehouseSummaryQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  Warehouse,
  CreateWarehouseInput,
} from '@/features/inventory/warehousesApi';

export default function WarehousesPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === 'ADMIN';

  // Fetch warehouses
  const { data, isLoading } = useGetWarehousesQuery();
  const warehouses = data?.data || [];

  // Summary Drawer State
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);

  // Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState<CreateWarehouseInput>({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contactPerson: '',
    contactPhone: '',
    isPrimary: false,
    isActive: true,
  });
  const [modalError, setModalError] = useState<string | null>(null);

  // Mutations
  const [createWarehouse, { isLoading: isCreating }] = useCreateWarehouseMutation();
  const [updateWarehouse, { isLoading: isUpdating }] = useUpdateWarehouseMutation();

  const handleOpenCreateModal = () => {
    setEditingWarehouse(null);
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      contactPerson: '',
      contactPhone: '',
      isPrimary: false,
      isActive: true,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setFormData({
      name: wh.name,
      code: wh.code,
      address: wh.address,
      city: wh.city,
      state: wh.state,
      pincode: wh.pincode,
      contactPerson: wh.contactPerson || '',
      contactPhone: wh.contactPhone || '',
      isPrimary: wh.isPrimary,
      isActive: wh.isActive,
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.name.trim() || !formData.city.trim() || !formData.state.trim() || !formData.address.trim()) {
      setModalError('Please fill in all required fields (Name, City, State, Address).');
      return;
    }

    try {
      if (editingWarehouse) {
        await updateWarehouse({
          id: editingWarehouse.id,
          name: formData.name.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          pincode: formData.pincode.trim(),
          contactPerson: formData.contactPerson?.trim() || null,
          contactPhone: formData.contactPhone?.trim() || null,
          isPrimary: formData.isPrimary,
          isActive: formData.isActive,
        }).unwrap();
      } else {
        await createWarehouse({
          name: formData.name.trim(),
          code: formData.code?.trim() || undefined,
          address: formData.address.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          pincode: formData.pincode.trim(),
          contactPerson: formData.contactPerson?.trim() || null,
          contactPhone: formData.contactPhone?.trim() || null,
          isPrimary: formData.isPrimary,
          isActive: formData.isActive,
        }).unwrap();
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setModalError(
        err?.data?.message || err?.message || 'Operation failed. Please verify your inputs.'
      );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Top Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#181818] tracking-tight">
            Warehouses{' '}
            <span className="text-sm font-normal text-[#706E6B]">
              ({isLoading ? '...' : warehouses.length})
            </span>
          </h1>
          <p className="text-xs text-[#706E6B] mt-0.5">
            Regional fulfillment facilities, primary dispatch hubs, and live stock valuations
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreateModal}
            className="h-9 px-4 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>Add Warehouse</span>
          </button>
        )}
      </div>

      {/* ─── Warehouses Grid (Card Layout) ──────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded border border-[#DDDBDA] p-5 shadow-xs animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 bg-slate-200 rounded w-44" />
                <div className="h-4 bg-slate-200 rounded w-16" />
              </div>
              <div className="h-3 bg-slate-100 rounded w-3/4" />
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="h-14 bg-slate-100 rounded" />
                <div className="h-14 bg-slate-100 rounded" />
                <div className="h-14 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              className="bg-white rounded border border-[#DDDBDA] p-5 shadow-[0_2px_4px_rgba(0,0,0,0.08)] flex flex-col justify-between hover:border-slate-300 transition-colors group"
            >
              <div>
                {/* Header: Name, Code & Badges */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-bold text-[#0176D3] bg-[#EAF5FE] px-2 py-0.5 rounded border border-[#D4E7F9]">
                        {wh.code}
                      </span>
                      {wh.isPrimary && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0176D3] text-white shadow-2xs">
                          <ShieldCheck size={11} />
                          PRIMARY
                        </span>
                      )}
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          wh.isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {wh.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-[#181818] tracking-tight">
                      {wh.name}
                    </h2>
                  </div>

                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <WarehouseIcon size={18} className="text-[#0176D3]" />
                  </div>
                </div>

                {/* Location & Contact Info */}
                <div className="space-y-1.5 text-xs text-[#444444] mb-4">
                  <div className="flex items-start gap-1.5">
                    <MapPin size={13} className="text-[#706E6B] shrink-0 mt-0.5" />
                    <span>
                      {wh.address}, {wh.city}, {wh.state} - {wh.pincode}
                    </span>
                  </div>

                  {(wh.contactPerson || wh.contactPhone) && (
                    <div className="flex items-center gap-3 text-[11px] text-[#706E6B] pt-0.5">
                      {wh.contactPerson && (
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {wh.contactPerson}
                        </span>
                      )}
                      {wh.contactPhone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {wh.contactPhone}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 3 Metric Pills */}
                <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 mb-4">
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200/60 text-center">
                    <span className="text-[10px] uppercase font-semibold text-[#706E6B] block">
                      Total SKUs
                    </span>
                    <span className="text-base font-bold text-[#181818] block mt-0.5">
                      {wh.totalProducts || 0}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200/60 text-center">
                    <span className="text-[10px] uppercase font-semibold text-[#706E6B] block">
                      Total Units
                    </span>
                    <span className="text-base font-bold text-[#181818] block mt-0.5">
                      {wh.totalStock || 0}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200/60 text-center">
                    <span className="text-[10px] uppercase font-semibold text-[#706E6B] block">
                      Stock Value
                    </span>
                    <span className="text-sm font-bold text-[#0176D3] block mt-1 truncate" title={formatCurrency(wh.stockValue || 0)}>
                      {formatCurrency(wh.stockValue || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(wh)}
                    className="h-8 px-3 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#444444] transition-colors flex items-center gap-1.5"
                  >
                    <Edit2 size={13} className="text-[#0176D3]" />
                    <span>Edit</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedWarehouseId(wh.id)}
                  className="h-8 px-3.5 rounded bg-blue-50 hover:bg-blue-100 text-[#0176D3] text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Eye size={13} />
                  <span>View Summary</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── WAREHOUSE SUMMARY DRAWER (480px) ───────────────────────── */}
      {selectedWarehouseId && (
        <WarehouseSummaryDrawer
          warehouseId={selectedWarehouseId}
          onClose={() => setSelectedWarehouseId(null)}
        />
      )}

      {/* ─── ADD / EDIT WAREHOUSE MODAL (560px) ─────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-[#DDDBDA] shadow-xl max-w-[560px] w-full p-5 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDDBDA] mb-4">
              <h3 className="text-base font-bold text-[#181818]">
                {editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-[#706E6B] hover:text-[#181818] hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-[#BA0517] flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                  Warehouse Name <span className="text-[#BA0517]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Mumbai Primary Hub"
                  className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    City <span className="text-[#BA0517]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Mumbai"
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                  <span className="text-[10px] text-[#706E6B] mt-0.5 block">
                    City prefix generates code (WH-MUM-01)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    State <span className="text-[#BA0517]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. Maharashtra"
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                  Physical Address <span className="text-[#BA0517]">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, Industrial Area, Plot No..."
                  className="w-full rounded border border-[#DDDBDA] p-2.5 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="400001"
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson || ''}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Manager name"
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444444] mb-1.5">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.contactPhone || ''}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="9876543210"
                    className="w-full h-9 rounded border border-[#DDDBDA] px-3 text-xs text-[#181818] focus:border-[#0176D3] focus:ring-1 focus:ring-[#0176D3] outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#181818]">
                  <input
                    type="checkbox"
                    checked={formData.isPrimary}
                    onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                    className="rounded border-[#DDDBDA] text-[#0176D3] focus:ring-[#0176D3] w-4 h-4 cursor-pointer"
                  />
                  <span>Mark as Primary Warehouse</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#181818]">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-[#DDDBDA] text-[#0176D3] focus:ring-[#0176D3] w-4 h-4 cursor-pointer"
                  />
                  <span>Active</span>
                </label>
              </div>

              <div className="pt-3 border-t border-[#DDDBDA] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-8 px-3 rounded border border-[#DDDBDA] hover:bg-slate-50 text-xs font-semibold text-[#444444] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || isUpdating}
                  className="h-8 px-4 rounded bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  {(isCreating || isUpdating) ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingWarehouse ? 'Save Changes' : 'Create Warehouse'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WAREHOUSE SUMMARY DRAWER (480px) ───────────────────────────────

function WarehouseSummaryDrawer({
  warehouseId,
  onClose,
}: {
  warehouseId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useGetWarehouseSummaryQuery(warehouseId);
  const summary = data?.data;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-[480px] bg-white shadow-2xl flex flex-col justify-between border-l border-[#DDDBDA] animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 border-b border-[#DDDBDA] flex items-center justify-between bg-slate-50/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#0176D3] bg-[#EAF5FE] px-2 py-0.5 rounded border border-[#D4E7F9]">
                  {summary?.warehouse?.code}
                </span>
                {summary?.warehouse?.isPrimary && (
                  <span className="text-[10px] font-bold bg-[#0176D3] text-white px-2 py-0.5 rounded-full">
                    PRIMARY
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-[#181818] mt-1">
                {summary?.warehouse?.name || 'Warehouse Summary'}
              </h2>
              <p className="text-[11px] text-[#706E6B]">
                {summary?.warehouse?.city}, {summary?.warehouse?.state}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-[#706E6B] hover:text-[#181818] hover:bg-slate-200/60 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-2">
                <Loader2 size={24} className="animate-spin text-[#0176D3]" />
                <span className="text-xs text-[#706E6B]">Loading warehouse stock summary...</span>
              </div>
            ) : (
              <>
                {/* 4 KPI Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded border border-slate-200/60">
                    <span className="text-[10px] font-semibold uppercase text-[#706E6B] block">
                      Total Variants
                    </span>
                    <span className="text-lg font-bold text-[#181818] block mt-0.5">
                      {summary?.totalVariantsStocked || 0}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded border border-slate-200/60">
                    <span className="text-[10px] font-semibold uppercase text-[#706E6B] block">
                      Total Stock
                    </span>
                    <span className="text-lg font-bold text-[#181818] block mt-0.5">
                      {summary?.totalPhysicalStock || 0}
                    </span>
                    <span className="text-[10px] text-[#706E6B]">
                      {summary?.totalAvailableStock || 0} avail
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded border border-slate-200/60">
                    <span className="text-[10px] font-semibold uppercase text-[#706E6B] block">
                      Low Stock Alerts
                    </span>
                    <span
                      className={`text-lg font-bold block mt-0.5 ${
                        (summary?.lowStockCount || 0) > 0 ? 'text-[#BA0517]' : 'text-[#2E844A]'
                      }`}
                    >
                      {summary?.lowStockCount || 0}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded border border-slate-200/60">
                    <span className="text-[10px] font-semibold uppercase text-[#706E6B] block">
                      Stock Value
                    </span>
                    <span className="text-sm font-bold text-[#0176D3] block mt-1 truncate">
                      {formatCurrency(summary?.totalStockValue || 0)}
                    </span>
                  </div>
                </div>

                {/* Stock Breakdown Table */}
                <div>
                  <h3 className="text-xs font-bold text-[#181818] uppercase tracking-wider mb-2">
                    Stock Breakdown by SKU
                  </h3>
                  <div className="rounded border border-[#DDDBDA] overflow-hidden">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-[#DDDBDA] bg-slate-50 text-[#706E6B] font-semibold">
                          <th className="py-2 px-2.5">Product & SKU</th>
                          <th className="py-2 px-2 text-center">Physical</th>
                          <th className="py-2 px-2 text-center">Avail</th>
                          <th className="py-2 px-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(summary?.items || []).map((item) => {
                          const statusColor =
                            item.status === 'IN_STOCK'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : item.status === 'LOW_STOCK'
                              ? 'text-amber-700 bg-amber-50 border-amber-200'
                              : 'text-rose-700 bg-rose-50 border-rose-200';

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-2.5">
                                <span className="font-semibold text-[#181818] block truncate max-w-[170px]">
                                  {item.productName}
                                </span>
                                <span className="font-mono text-[10px] text-[#706E6B] block">
                                  {item.variantSku}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center text-[#706E6B]">
                                {item.physicalQuantity}
                              </td>
                              <td className="py-2 px-2 text-center font-bold text-[#181818]">
                                {item.availableQuantity}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span
                                  className={`inline-block px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${statusColor}`}
                                >
                                  {item.status.replace('_', ' ')}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[#DDDBDA] bg-slate-50 flex justify-end">
            <button
              onClick={onClose}
              className="h-8 px-4 rounded border border-[#DDDBDA] bg-white hover:bg-slate-50 text-xs font-semibold text-[#444444]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
