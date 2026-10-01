'use client';

import { InfoTip } from '@/components/ui/info-tip';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  UserCheck,
  TrendingUp,
  ShoppingBag,
  Percent,
  History,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  AlertCircle,
  Warehouse,
  ExternalLink,
  ShieldAlert,
  X,
  FileText,
  BadgePercent,
  Check,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  useGetDealerByIdQuery,
  useApproveDealerMutation,
  useRejectDealerMutation,
  useDeactivateDealerMutation,
  useReactivateDealerMutation,
  useSetDealerDiscountMutation,
  useDeleteDealerDiscountMutation,
  useImpersonateDealerMutation,
  CategoryDiscountItem,
} from '@/features/dealers/dealersApi';
import { useGetWarehousesQuery } from '@/features/inventory/warehousesApi';
import { useGetCategoryFlatQuery } from '@/features/categories/categoriesApi';
import { toast } from '@/components/ui/toast';
import { confirmDialog } from '@/components/ui/confirm-dialog';

export default function DealerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const dealerId = params.id as string;
  const { user: currentUser } = useAppSelector((state) => state.auth);

  // Admin guard
  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      router.replace('/orders');
    }
  }, [currentUser, router]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'discounts' | 'activity'>('overview');

  // Queries
  const { data: dealerData, isLoading, isError, refetch } = useGetDealerByIdQuery(dealerId);
  const { data: warehousesResponse } = useGetWarehousesQuery();
  const { data: leafCategoriesResponse } = useGetCategoryFlatQuery({ level: 3 });

  const warehouses = warehousesResponse?.data || [];
  const leafCategories = leafCategoriesResponse?.data || [];
  const dealer = dealerData?.data;

  // Mutations
  const [approveDealer, { isLoading: isApproving }] = useApproveDealerMutation();
  const [rejectDealer, { isLoading: isRejecting }] = useRejectDealerMutation();
  const [deactivateDealer, { isLoading: isDeactivating }] = useDeactivateDealerMutation();
  const [reactivateDealer, { isLoading: isReactivating }] = useReactivateDealerMutation();
  const [setDealerDiscount, { isLoading: isSavingDiscount }] = useSetDealerDiscountMutation();
  const [deleteDealerDiscount, { isLoading: isDeletingDiscount }] = useDeleteDealerDiscountMutation();
  const [impersonateDealer, { isLoading: isImpersonating }] = useImpersonateDealerMutation();

  // Modals state
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<CategoryDiscountItem | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for approve/reject
  const [approveCreditLimit, setApproveCreditLimit] = useState('200000');
  const [approveCreditDays, setApproveCreditDays] = useState('30');
  const [approveWarehouseId, setApproveWarehouseId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Set default values when dealer data arrives
  useEffect(() => {
    if (dealer) {
      setApproveCreditLimit(dealer.creditLimit ? String(dealer.creditLimit) : '200000');
      setApproveCreditDays(dealer.creditDays ? String(dealer.creditDays) : '30');
      setApproveWarehouseId(dealer.assignedWarehouseId || (warehouses[0]?.id || ''));
    }
  }, [dealer, warehouses]);

  // Handle Approve
  const handleConfirmApprove = async () => {
    if (!dealer) return;
    try {
      await approveDealer({
        id: dealer.id,
        creditLimit: parseFloat(approveCreditLimit) || 0,
        creditDays: parseInt(approveCreditDays, 10) || 30,
        assignedWarehouseId: approveWarehouseId || null,
      }).unwrap();
      setIsApproveOpen(false);
      setFeedbackMsg({ type: 'success', text: `Dealer approved successfully!` });
      setTimeout(() => setFeedbackMsg(null), 4000);
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.data?.message || 'Failed to approve dealer' });
    }
  };

  // Handle Reject
  const handleConfirmReject = async () => {
    if (!dealer) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) {
      toast.error('Please enter a rejection reason (at least 3 characters)');
      return;
    }
    try {
      await rejectDealer({
        id: dealer.id,
        rejectionReason: rejectionReason.trim(),
      }).unwrap();
      setIsRejectOpen(false);
      setFeedbackMsg({ type: 'success', text: 'Dealer application rejected.' });
      setTimeout(() => setFeedbackMsg(null), 4000);
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.data?.message || 'Failed to reject dealer' });
    }
  };

  // Handle Toggle Active
  const handleToggleDeactivate = async () => {
    if (!dealer) return;
    const isApproved = dealer.status === 'APPROVED';
    const action = isApproved ? 'deactivate' : 'reactivate';
    if (!(await confirmDialog({ title: `${action[0].toUpperCase()}${action.slice(1)} dealer?`, message: `Are you sure you want to ${action} this dealer?`, confirmLabel: action[0].toUpperCase() + action.slice(1), destructive: isApproved }))) return;

    try {
      if (isApproved) {
        await deactivateDealer(dealer.id).unwrap();
        setFeedbackMsg({ type: 'success', text: 'Dealer deactivated successfully.' });
      } else {
        await reactivateDealer(dealer.id).unwrap();
        setFeedbackMsg({ type: 'success', text: 'Dealer reactivated successfully.' });
      }
      setTimeout(() => setFeedbackMsg(null), 4000);
      refetch();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.data?.message || `Failed to ${action} dealer` });
    }
  };

  // Handle Impersonation
  const handleImpersonate = async () => {
    if (!dealer || !currentUser) return;
    if (dealer.status !== 'APPROVED') {
      toast.error('Only APPROVED dealers can be impersonated.');
      return;
    }

    try {
      const res = await impersonateDealer(dealer.id).unwrap();
      if (res?.data) {
        dispatch(
          setCredentials({
            token: res.data.accessToken,
            user: res.data.user,
            isImpersonated: true,
            impersonatedBy: { id: currentUser.id, name: currentUser.name },
          })
        );
        router.push('/orders');
      }
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to impersonate dealer');
    }
  };

  // Open Discount Modal (Add or Edit)
  const openDiscountModal = (discount?: CategoryDiscountItem) => {
    if (discount) {
      setEditingDiscount(discount);
      setSelectedCategoryId(discount.categoryId);
      setDiscountPercent(String(discount.discountPercentage));
    } else {
      setEditingDiscount(null);
      // Select first leaf category not already discounted
      const existingIds = new Set((dealer?.categoryDiscounts || []).map((d) => d.categoryId));
      const available = leafCategories.find((c) => !existingIds.has(c.id));
      setSelectedCategoryId(available ? available.id : leafCategories[0]?.id || '');
      setDiscountPercent('10');
    }
    setIsDiscountModalOpen(true);
  };

  // Save Discount
  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealer || !selectedCategoryId) return;

    const val = parseFloat(discountPercent);
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error('Discount percentage must be between 0 and 100');
      return;
    }

    try {
      await setDealerDiscount({
        id: dealer.id,
        categoryId: selectedCategoryId,
        discountPercentage: val,
      }).unwrap();
      setIsDiscountModalOpen(false);
      setEditingDiscount(null);
      setFeedbackMsg({ type: 'success', text: 'Category discount saved successfully!' });
      setTimeout(() => setFeedbackMsg(null), 4000);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to set discount');
    }
  };

  // Delete Discount
  const handleDeleteDiscount = async (categoryId: string) => {
    if (!dealer) return;
    if (!(await confirmDialog({ title: 'Remove discount?', message: 'This category discount will be removed for the dealer.', confirmLabel: 'Remove', destructive: true }))) return;

    try {
      await deleteDealerDiscount({
        id: dealer.id,
        categoryId,
      }).unwrap();
      setFeedbackMsg({ type: 'success', text: 'Category discount removed.' });
      setTimeout(() => setFeedbackMsg(null), 4000);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to remove discount');
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Loader2 size={24} className="animate-spin text-[#0176D3]" />
        <p className="text-xs">Loading dealer details...</p>
      </div>
    );
  }

  if (isError || !dealer) {
    return (
      <div className="bg-white rounded border border-[#DDDBDA] p-12 text-center space-y-3">
        <AlertCircle size={40} className="mx-auto text-[#BA0517]" />
        <h2 className="text-base font-bold text-[#181818]">Dealer Not Found</h2>
        <p className="text-xs text-[#706E6B]">The dealer account does not exist or may have been deleted.</p>
        <Link
          href="/dealers"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] text-white text-xs font-semibold rounded hover:bg-[#014486] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Dealers
        </Link>
      </div>
    );
  }

  const stats = dealer.stats || {
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    outstandingAmount: 0,
    creditLimit: Number(dealer.creditLimit || 0),
    remainingCreditLimit: Number(dealer.remainingCreditLimit || 0),
    usedCredit: 0,
    creditUtilizationPercent: 0,
    lastOrderDate: null,
  };

  // Credit progress styling
  const utilPercent = stats.creditUtilizationPercent || 0;
  let utilColor = 'bg-[#2E844A]';
  let utilTextColor = 'text-[#2E844A]';
  if (utilPercent >= 80) {
    utilColor = 'bg-[#BA0517]';
    utilTextColor = 'text-[#BA0517]';
  } else if (utilPercent >= 50) {
    utilColor = 'bg-[#DD7A01]';
    utilTextColor = 'text-[#DD7A01]';
  }

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

      {/* Header Bar */}
      <div className="bg-white p-5 rounded border border-[#DDDBDA] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/dealers"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#706E6B] hover:text-[#0176D3] transition-colors"
          >
            <ArrowLeft size={14} /> Back to Dealers
          </Link>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {dealer.status === 'APPROVED' && (
              <>
                <button
                  onClick={handleImpersonate}
                  disabled={isImpersonating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
                  title="Impersonate dealer session"
                >
                  <UserCheck size={14} />
                  <span>Login as Dealer</span>
                </button>
                <button
                  onClick={handleToggleDeactivate}
                  disabled={isDeactivating}
                  className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:text-[#BA0517] hover:border-[#BA0517] text-xs font-medium rounded transition-colors"
                >
                  Deactivate
                </button>
              </>
            )}

            {dealer.status === 'PENDING' && (
              <>
                <button
                  onClick={() => setIsApproveOpen(true)}
                  className="px-3 py-1.5 bg-[#2E844A] hover:bg-[#256B3B] text-white text-xs font-semibold rounded transition-colors shadow-sm"
                >
                  Approve Application
                </button>
                <button
                  onClick={() => setIsRejectOpen(true)}
                  className="px-3 py-1.5 bg-[#BA0517] hover:bg-[#8E0412] text-white text-xs font-semibold rounded transition-colors shadow-sm"
                >
                  Reject Application
                </button>
              </>
            )}

            {dealer.status === 'INACTIVE' && (
              <button
                onClick={handleToggleDeactivate}
                disabled={isReactivating}
                className="px-3 py-1.5 bg-slate-800 hover:bg-black text-white text-xs font-semibold rounded transition-colors shadow-sm"
              >
                Reactivate Dealer
              </button>
            )}
          </div>
        </div>

        {/* Dealer Identity & Meta */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center font-bold text-lg shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-[#181818]">
                  {dealer.businessName || dealer.name}
                </h1>

                {/* Status Pill */}
                {dealer.status === 'PENDING' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF4E5] text-[#DD7A01] border border-[#F5C278]">
                    <Clock size={11} />
                    Pending Approval
                  </span>
                )}
                {dealer.status === 'APPROVED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF5EE] text-[#2E844A] border border-[#C3E6CD]">
                    <CheckCircle size={11} />
                    Approved
                  </span>
                )}
                {dealer.status === 'REJECTED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF3F2] text-[#BA0517] border border-[#F8D7DA]">
                    <XCircle size={11} />
                    Rejected
                  </span>
                )}
                {dealer.status === 'INACTIVE' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    <Ban size={11} />
                    Inactive
                  </span>
                )}

                {dealer.assignedWarehouse && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                    <Warehouse size={12} className="text-slate-500" />
                    {dealer.assignedWarehouse.name} ({dealer.assignedWarehouse.code})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-[#706E6B] mt-1.5 flex-wrap">
                <span className="font-medium text-[#181818]">{dealer.name}</span>
                <span className="flex items-center gap-1">
                  <Mail size={12} className="text-slate-400" />
                  <a href={`mailto:${dealer.email}`} className="hover:underline hover:text-[#0176D3]">
                    {dealer.email}
                  </a>
                </span>
                {dealer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={12} className="text-slate-400" />
                    <span>{dealer.phone}</span>
                  </span>
                )}
                {dealer.gstNumber && (
                  <span className="flex items-center gap-1 font-mono font-medium text-slate-700">
                    <FileText size={12} className="text-slate-400" />
                    GSTIN: {dealer.gstNumber}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Orders */}
        <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs">
          <div className="flex items-center justify-between text-[#706E6B] mb-2">
            <span className="text-xs font-semibold">Total Orders</span>
            <div className="p-1.5 rounded bg-[#EAF5FE] text-[#0176D3]">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="text-xl font-bold text-[#181818]">{stats.totalOrders}</div>
          <div className="text-[11px] text-[#706E6B] mt-1">
            Last Order: {stats.lastOrderDate ? formatDate(stats.lastOrderDate) : 'Never'}
          </div>
        </div>

        {/* Lifetime Spend */}
        <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs">
          <div className="flex items-center justify-between text-[#706E6B] mb-2">
            <span className="text-xs font-semibold flex items-center gap-1">
              Total Order Value
              <InfoTip text="Sum of all confirmed, processing, dispatched and delivered orders (excl. cancelled)" />
            </span>
            <div className="p-1.5 rounded bg-[#EBF5EE] text-[#2E844A]">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-xl font-bold text-[#181818]">
            {formatCurrency(stats.totalRevenue)}
          </div>
          <div className="text-[11px] text-[#706E6B] mt-1">all non-cancelled orders</div>
        </div>

        {/* Outstanding Due (Unpaid Order Amounts) */}
        <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs">
          <div className="flex items-center justify-between text-[#706E6B] mb-2">
            <span className="text-xs font-semibold">Outstanding Due</span>
            <div className="p-1.5 rounded bg-[#FFF8E7] text-[#DD7A01]">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="text-xl font-bold text-[#181818]">
            {formatCurrency(stats.outstandingAmount)}
          </div>
          <div className="text-[11px] text-[#706E6B] mt-1">
            Unpaid order amounts
          </div>
        </div>

        {/* Credit Used (Credit Limit Consumed) */}
        <div className="bg-white p-4 rounded border border-[#DDDBDA] shadow-xs">
          <div className="flex items-center justify-between text-[#706E6B] mb-2">
            <span className="text-xs font-semibold">Credit Used</span>
            <span className={`text-xs font-bold ${utilTextColor}`}>{utilPercent}%</span>
          </div>
          <div className="text-xl font-bold text-[#181818]">
            {formatCurrency(stats.usedCredit)}
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden my-1.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${utilColor}`}
              style={{ width: `${Math.min(100, utilPercent)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-[#706E6B]">
            <span>Avail: {formatCurrency(stats.remainingCreditLimit)}</span>
            <span>Limit: {formatCurrency(stats.creditLimit)}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-[#DDDBDA] bg-white px-4 pt-1 rounded-t border-x shadow-xs">
        {[
          { key: 'overview', label: 'Overview', icon: Building2 },
          { key: 'orders', label: `Orders (${stats.totalOrders})`, icon: ShoppingBag },
          { key: 'discounts', label: `Discounts (${dealer.categoryDiscounts?.length || 0})`, icon: BadgePercent },
          { key: 'activity', label: `Activity (${dealer.activityLogs?.length || 0})`, icon: History },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                isActive
                  ? 'border-[#0176D3] text-[#0176D3] font-semibold'
                  : 'border-transparent text-[#706E6B] hover:text-[#181818]'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-b border border-t-0 border-[#DDDBDA] p-5 shadow-sm">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {dealer.status === 'REJECTED' && dealer.rejectionReason && (
              <div className="p-4 rounded-lg bg-[#FDF3F2] border border-[#F8D7DA] text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-[#BA0517]">
                  <ShieldAlert size={16} />
                  <span>Rejection Reason</span>
                </div>
                <p className="text-slate-800 pl-6">{dealer.rejectionReason}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Business Profile Card */}
              <div className="p-4 rounded border border-[#DDDBDA] bg-white space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#706E6B] border-b pb-2">
                  Business Information
                </h3>
                <dl className="text-xs space-y-2.5">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Business / Company</dt>
                    <dd className="font-semibold text-slate-800">{dealer.businessName || '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Contact Person</dt>
                    <dd className="font-medium text-slate-800">{dealer.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Email Address</dt>
                    <dd className="text-slate-800">{dealer.email}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="text-slate-800">{dealer.phone || '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">GSTIN</dt>
                    <dd className="font-mono font-medium text-slate-800">
                      {dealer.gstNumber || 'Not Provided'}
                    </dd>
                  </div>
                  <div className="flex justify-between pt-1">
                    <dt className="text-slate-500">Business Address</dt>
                    <dd className="text-right text-slate-800 max-w-xs">{dealer.businessAddress || '—'}</dd>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <dt className="text-slate-500">Joined On</dt>
                    <dd className="text-slate-800">{formatDate(dealer.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Last Login</dt>
                    <dd className="text-slate-800">
                      {dealer.lastLoginAt ? formatDate(dealer.lastLoginAt) : 'Never'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Credit & Terms Card */}
              <div className="p-4 rounded border border-[#DDDBDA] bg-white space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#706E6B] border-b pb-2">
                  Credit Terms & Financials
                </h3>
                <dl className="text-xs space-y-2.5">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Credit Limit</dt>
                    <dd className="font-bold text-[#181818]">{formatCurrency(stats.creditLimit)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Payment Period</dt>
                    <dd className="font-semibold text-slate-800">{dealer.creditDays || 30} Days</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Used Credit</dt>
                    <dd className="font-semibold text-slate-800">{formatCurrency(stats.usedCredit)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Remaining Available Credit</dt>
                    <dd className="font-bold text-[#2E844A]">
                      {formatCurrency(stats.remainingCreditLimit)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Outstanding Unpaid</dt>
                    <dd className="font-semibold text-[#DD7A01]">
                      {formatCurrency(stats.outstandingAmount)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <dt className="text-slate-500">Assigned Warehouse</dt>
                    <dd className="font-semibold text-[#0176D3]">
                      {dealer.assignedWarehouse
                        ? `${dealer.assignedWarehouse.name} (${dealer.assignedWarehouse.code})`
                        : 'Default (Auto-assigned)'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Payment Reminder Buffer</dt>
                    <dd className="text-slate-800">
                      {dealer.paymentReminderDaysBefore || 3} days before due
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#181818]">Recent Orders</h3>
                <p className="text-xs text-[#706E6B]">Latest orders placed by this dealer</p>
              </div>
              <Link
                href={`/orders?dealer=${dealer.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0176D3] hover:underline"
              >
                <span>View all orders in Orders Module</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {(!dealer.recentOrders || dealer.recentOrders.length === 0) ? (
              <div className="py-12 text-center text-slate-400">
                <ShoppingBag size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium text-slate-600">No orders placed yet</p>
                <p className="text-[11px] text-slate-400">
                  When this dealer places orders, they will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#DDDBDA] rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8F9FA] text-[#706E6B] font-semibold uppercase text-[10px] tracking-wider border-b border-[#DDDBDA]">
                      <th className="py-2.5 px-4">Order #</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Order Status</th>
                      <th className="py-2.5 px-4">Payment</th>
                      <th className="py-2.5 px-4 text-right">Grand Total</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDDBDA]">
                    {dealer.recentOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#0176D3]">
                          <Link href={`/orders/${ord.id}`} className="hover:underline">
                            {ord.orderNumber}
                          </Link>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{formatDate(ord.createdAt)}</td>
                        <td className="py-2.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              ord.paymentStatus === 'PAID'
                                ? 'bg-[#EBF5EE] text-[#2E844A]'
                                : 'bg-[#FFF8E7] text-[#DD7A01]'
                            }`}
                          >
                            {ord.paymentStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                          {formatCurrency(ord.grandTotal)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Link
                            href={`/orders/${ord.id}`}
                            className="text-[#0176D3] hover:underline font-medium text-[11px]"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CATEGORY DISCOUNTS */}
        {activeTab === 'discounts' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#181818]">Category Discount Matrix</h3>
                <p className="text-xs text-[#706E6B]">
                  Specific percentage discounts applied to leaf (Level 3) categories for this dealer.
                </p>
              </div>
              <button
                onClick={() => openDiscountModal()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold rounded transition-colors shadow-sm self-start"
              >
                <Plus size={14} />
                <span>Add Category Discount</span>
              </button>
            </div>

            {(!dealer.categoryDiscounts || dealer.categoryDiscounts.length === 0) ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-[#DDDBDA] rounded">
                <Percent size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium text-slate-600">No Category Discounts Configured</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Dealer receives standard catalog prices unless specific category discounts are assigned.
                </p>
                <button
                  onClick={() => openDiscountModal()}
                  className="mt-3 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition-colors"
                >
                  Set First Discount
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#DDDBDA] rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8F9FA] text-[#706E6B] font-semibold uppercase text-[10px] tracking-wider border-b border-[#DDDBDA]">
                      <th className="py-2.5 px-4">Level 3 Category</th>
                      <th className="py-2.5 px-4">Slug</th>
                      <th className="py-2.5 px-4">Discount</th>
                      <th className="py-2.5 px-4">Assigned On</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDDBDA]">
                    {dealer.categoryDiscounts.map((disc) => (
                      <tr key={disc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-[#181818]">
                          {disc.category?.name || 'Category'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                          {disc.category?.slug}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EBF5EE] text-[#2E844A] border border-[#C3E6CD]">
                            <Percent size={11} />
                            {Number(disc.discountPercentage).toFixed(2)}% OFF
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{formatDate(disc.createdAt)}</td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => openDiscountModal(disc)}
                              className="text-slate-400 hover:text-[#0176D3] transition-colors p-1"
                              title="Edit Discount"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteDiscount(disc.categoryId)}
                              className="text-slate-400 hover:text-[#BA0517] transition-colors p-1"
                              title="Remove Discount"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ACTIVITY LOG */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#181818]">Audit Trail & Activity Log</h3>
              <p className="text-xs text-[#706E6B]">Recent administrative and dealer actions recorded</p>
            </div>

            {(!dealer.activityLogs || dealer.activityLogs.length === 0) ? (
              <div className="py-12 text-center text-slate-400">
                <History size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium text-slate-600">No activity recorded yet</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#DDDBDA]">
                {dealer.activityLogs.map((log) => (
                  <div key={log.id} className="relative flex items-start gap-3">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#0176D3] ring-4 ring-white" />
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 uppercase text-[11px] tracking-wide">
                          {log.action}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(log.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono">
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* APPROVE MODAL (480px) */}
      {isApproveOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[480px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EBF5EE] text-[#2E844A] flex items-center justify-center font-bold">
                  <CheckCircle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Approve Dealer</h3>
                  <p className="text-[11px] text-[#706E6B]">{dealer.businessName || dealer.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsApproveOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#181818] mb-1">
                  Credit Limit (₹) <span className="text-[#BA0517]">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={approveCreditLimit}
                  onChange={(e) => setApproveCreditLimit(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#181818] mb-1">
                  Credit Period (Days) <span className="text-[#BA0517]">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={approveCreditDays}
                  onChange={(e) => setApproveCreditDays(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#181818] mb-1">Assigned Warehouse</label>
                <select
                  value={approveWarehouseId}
                  onChange={(e) => setApproveWarehouseId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] bg-white"
                >
                  <option value="">No specific warehouse (Default)</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code}) {wh.isPrimary ? '— Primary Hub' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2">
              <button
                onClick={() => setIsApproveOpen(false)}
                className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:bg-white text-xs font-medium rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApprove}
                disabled={isApproving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2E844A] hover:bg-[#256B3B] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
              >
                {isApproving && <Loader2 size={12} className="animate-spin" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL (480px) */}
      {isRejectOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[480px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FDF3F2] text-[#BA0517] flex items-center justify-center font-bold">
                  <XCircle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Reject Dealer Application</h3>
                  <p className="text-[11px] text-[#706E6B]">{dealer.businessName || dealer.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsRejectOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#181818] mb-1">
                  Rejection Reason <span className="text-[#BA0517]">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Incomplete GST documentation or unverified business address."
                  className="w-full px-3 py-2 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2">
              <button
                onClick={() => setIsRejectOpen(false)}
                className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:bg-white text-xs font-medium rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={isRejecting || rejectionReason.trim().length < 3}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#BA0517] hover:bg-[#8E0412] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
              >
                {isRejecting && <Loader2 size={12} className="animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY DISCOUNT MODAL (440px) */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[440px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center font-bold">
                  <BadgePercent size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">
                    {editingDiscount ? 'Edit Category Discount' : 'Add Category Discount'}
                  </h3>
                  <p className="text-[11px] text-[#706E6B]">Configure custom discount on Level 3 leaf category</p>
                </div>
              </div>
              <button
                onClick={() => setIsDiscountModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveDiscount}>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">
                    Select Level 3 Category <span className="text-[#BA0517]">*</span>
                  </label>
                  {editingDiscount ? (
                    <div className="p-2 rounded bg-slate-100 text-xs font-semibold text-slate-800">
                      {editingDiscount.category?.name}
                    </div>
                  ) : (
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] bg-white"
                    >
                      {leafCategories.length === 0 && <option value="">No Level 3 categories available</option>}
                      {leafCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({cat.breadcrumbPath || cat.slug})
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-[#706E6B] mt-0.5">
                    Only Level 3 leaf categories can have direct discount rules.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">
                    Discount Percentage (%) <span className="text-[#BA0517]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      required
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      placeholder="e.g. 15.0"
                      className="w-full pl-3 pr-8 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-[#706E6B] mt-0.5">Applied on top of base catalog price.</p>
                </div>
              </div>

              <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(false)}
                  className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:bg-white text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDiscount}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSavingDiscount && <Loader2 size={12} className="animate-spin" />}
                  Save Discount
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
