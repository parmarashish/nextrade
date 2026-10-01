'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  UserCheck,
  ChevronRight,
  Loader2,
  Building2,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  CreditCard,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  X,
  Warehouse,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  useGetDealersQuery,
  useApproveDealerMutation,
  useRejectDealerMutation,
  useDeactivateDealerMutation,
  useReactivateDealerMutation,
  useCreateDealerMutation,
  useImpersonateDealerMutation,
  Dealer,
} from '@/features/dealers/dealersApi';
import { useGetWarehousesQuery } from '@/features/inventory/warehousesApi';
import { toast } from '@/components/ui/toast';
import { confirmDialog } from '@/components/ui/confirm-dialog';

import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/ui/data-pagination';
export default function DealersPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">Loading dealers...</div>}>
      <DealersContent />
    </Suspense>
  );
}

function DealersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const { user: currentUser } = useAppSelector((state) => state.auth);

  // Guard: Admin only
  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      router.replace('/orders');
    }
  }, [currentUser, router]);

  // Tab & Filter States
  const initialStatus = searchParams.get('status') || 'ALL';
  const [activeTab, setActiveTab] = useState<string>(initialStatus.toUpperCase());
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Query dealers
  const { data: dealersResponse, isLoading, isFetching, refetch } = useGetDealersQuery({
    page,
    limit,
    search: debouncedSearch || undefined,
    status: activeTab !== 'ALL' ? activeTab : undefined,
  });

  const { data: warehousesResponse } = useGetWarehousesQuery();
  const warehouses = warehousesResponse?.data || [];

  // Mutations
  const [approveDealer, { isLoading: isApproving }] = useApproveDealerMutation();
  const [rejectDealer, { isLoading: isRejecting }] = useRejectDealerMutation();
  const [deactivateDealer, { isLoading: isDeactivating }] = useDeactivateDealerMutation();
  const [reactivateDealer, { isLoading: isReactivating }] = useReactivateDealerMutation();
  const [createDealer, { isLoading: isCreating }] = useCreateDealerMutation();
  const [impersonateDealer, { isLoading: isImpersonating }] = useImpersonateDealerMutation();

  // Modals state
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Approve form state
  const [approveCreditLimit, setApproveCreditLimit] = useState('200000');
  const [approveCreditDays, setApproveCreditDays] = useState('30');
  const [approveWarehouseId, setApproveWarehouseId] = useState('');

  // Reject form state
  const [rejectionReason, setRejectionReason] = useState('');

  // Add Dealer form state
  const [newDealerForm, setNewDealerForm] = useState({
    businessName: '',
    name: '',
    email: '',
    phone: '',
    businessAddress: '',
    gstNumber: '',
    password: '',
  });

  // Generate a random 12-char temporary password each time the modal opens
  const generatePassword = () => {
    const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '@#$%&*!'];
    const all = sets.join('');
    const rnd = (n: number) => {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] % n;
    };
    const chars = sets.map((set) => set[rnd(set.length)]);
    while (chars.length < 12) chars.push(all[rnd(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  };

  const [passwordCopied, setPasswordCopied] = useState(false);
  useEffect(() => {
    if (isAddOpen) {
      setNewDealerForm((f) => ({ ...f, password: generatePassword() }));
      setPasswordCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddOpen]);

  // Handle Tab Switch
  const handleTabChange = (status: string) => {
    setActiveTab(status);
    setPage(1);
  };

  // Open Approve Modal
  const openApproveModal = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setApproveCreditLimit(dealer.creditLimit ? String(dealer.creditLimit) : '200000');
    setApproveCreditDays(dealer.creditDays ? String(dealer.creditDays) : '30');
    setApproveWarehouseId(dealer.assignedWarehouseId || (warehouses[0]?.id || ''));
    setIsApproveOpen(true);
  };

  // Submit Approve
  const handleConfirmApprove = async () => {
    if (!selectedDealer) return;
    try {
      await approveDealer({
        id: selectedDealer.id,
        creditLimit: parseFloat(approveCreditLimit) || 0,
        creditDays: parseInt(approveCreditDays, 10) || 30,
        assignedWarehouseId: approveWarehouseId || null,
      }).unwrap();
      setIsApproveOpen(false);
      setSelectedDealer(null);
      setFeedbackMsg({ type: 'success', text: `Dealer ${selectedDealer.businessName || selectedDealer.name} approved successfully!` });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.data?.message || 'Failed to approve dealer' });
    }
  };

  // Open Reject Modal
  const openRejectModal = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setRejectionReason('');
    setIsRejectOpen(true);
  };

  // Submit Reject
  const handleConfirmReject = async () => {
    if (!selectedDealer) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) {
      toast.error('Please provide a valid rejection reason (at least 3 characters)');
      return;
    }
    try {
      await rejectDealer({
        id: selectedDealer.id,
        rejectionReason: rejectionReason.trim(),
      }).unwrap();
      setIsRejectOpen(false);
      setSelectedDealer(null);
      setFeedbackMsg({ type: 'success', text: `Dealer ${selectedDealer.businessName || selectedDealer.name} rejected.` });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.data?.message || 'Failed to reject dealer' });
    }
  };

  // Toggle Active/Inactive
  const handleToggleDeactivate = async (dealer: Dealer) => {
    const isApproved = dealer.status === 'APPROVED';
    const action = isApproved ? 'deactivate' : 'reactivate';
    if (!(await confirmDialog({ title: `${action[0].toUpperCase()}${action.slice(1)} dealer?`, message: `Are you sure you want to ${action} ${dealer.businessName || dealer.name}?`, confirmLabel: action[0].toUpperCase() + action.slice(1), destructive: isApproved }))) return;

    try {
      if (isApproved) {
        await deactivateDealer(dealer.id).unwrap();
        setFeedbackMsg({ type: 'success', text: `Dealer deactivated successfully.` });
      } else {
        await reactivateDealer(dealer.id).unwrap();
        setFeedbackMsg({ type: 'success', text: `Dealer reactivated successfully.` });
      }
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.data?.message || `Failed to ${action} dealer` });
    }
  };

  // Impersonate Flow
  const handleImpersonate = async (dealer: Dealer) => {
    if (!currentUser) return;
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

  // Submit Add Dealer
  const handleCreateDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createDealer({
        ...newDealerForm,
        gstNumber: newDealerForm.gstNumber ? newDealerForm.gstNumber.trim().toUpperCase() : undefined,
      }).unwrap();
      setIsAddOpen(false);
      setNewDealerForm({
        businessName: '',
        name: '',
        email: '',
        phone: '',
        businessAddress: '',
        gstNumber: '',
        password: '',
      });
      setFeedbackMsg({ type: 'success', text: 'Dealer registered successfully in PENDING status.' });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      toast.error(err?.data?.message || 'Failed to create dealer');
    }
  };

  const counts = dealersResponse?.counts || {
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    inactive: 0,
  };

  const dealersList = dealersResponse?.data || [];
  const meta = dealersResponse?.meta || { total: 0, page: 1, limit: DEFAULT_PAGE_SIZE, totalPages: 1 };

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

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded border border-[#DDDBDA] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#181818]">Dealers</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {counts.all}
              </span>
            </div>
            <p className="text-xs text-[#706E6B]">Manage B2B dealer accounts, credit terms, and status</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative w-64 sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search company, name, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Add Dealer Button */}
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-medium rounded transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={14} />
            <span>Add Dealer</span>
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-[#DDDBDA] bg-white px-4 pt-1 rounded-t border-x">
        {[
          { key: 'ALL', label: 'All', count: counts.all },
          { key: 'PENDING', label: 'Pending Approval', count: counts.pending, isPending: true },
          { key: 'APPROVED', label: 'Approved', count: counts.approved },
          { key: 'REJECTED', label: 'Rejected', count: counts.rejected },
          { key: 'INACTIVE', label: 'Inactive', count: counts.inactive },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                isActive
                  ? 'border-[#0176D3] text-[#0176D3] font-semibold'
                  : 'border-transparent text-[#706E6B] hover:text-[#181818]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  tab.isPending && tab.count > 0
                    ? 'bg-[#FEF3D6] text-[#DD7A01]'
                    : isActive
                    ? 'bg-[#EAF5FE] text-[#0176D3]'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dealers Table Card */}
      <div className="bg-white rounded-b border border-t-0 border-[#DDDBDA] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={24} className="animate-spin text-[#0176D3]" />
            <p className="text-xs">Loading dealer accounts...</p>
          </div>
        ) : dealersList.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Building2 size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-medium text-slate-600">No dealers found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {debouncedSearch
                ? `No results match "${debouncedSearch}" in ${activeTab.toLowerCase()} status.`
                : `There are currently no dealers in ${activeTab.toLowerCase()} status.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] text-[#706E6B] font-semibold uppercase text-[10px] tracking-wider border-b border-[#DDDBDA]">
                  <th className="py-3 px-2.5">Company & Contact</th>
                  <th className="py-3 px-2.5">Email</th>
                  <th className="py-3 px-2.5">Phone</th>
                  <th className="py-3 px-2.5">Credit Limit</th>
                  <th className="py-3 px-2.5 w-44">Credit Used</th>
                  <th className="py-3 px-2.5 text-center">Orders</th>
                  <th className="py-3 px-2.5">Status</th>
                  <th className="py-3 px-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDDBDA]">
                {dealersList.map((dealer) => {
                  const creditLimit = Number(dealer.creditLimit || 0);
                  const remainingCredit = Number(dealer.remainingCreditLimit || 0);
                  const usedCredit = Math.max(0, creditLimit - remainingCredit);
                  const usedPercent =
                    creditLimit > 0 ? Math.min(100, Math.round((usedCredit / creditLimit) * 100)) : 0;

                  // Progress bar color
                  let progressColor = 'bg-[#2E844A]'; // Green <50%
                  let progressBg = 'bg-[#EBF5EE]';
                  let textColor = 'text-[#2E844A]';
                  if (usedPercent >= 80) {
                    progressColor = 'bg-[#BA0517]'; // Red >80%
                    progressBg = 'bg-[#FDF3F2]';
                    textColor = 'text-[#BA0517]';
                  } else if (usedPercent >= 50) {
                    progressColor = 'bg-[#DD7A01]'; // Orange 50-80%
                    progressBg = 'bg-[#FFF8E7]';
                    textColor = 'text-[#DD7A01]';
                  }

                  return (
                    <tr
                      key={dealer.id}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/dealers/${dealer.id}`)}
                    >
                      {/* Company & Contact */}
                      <td className="py-3 px-2.5">
                        <div className="font-semibold text-[#181818] group-hover:text-[#0176D3] transition-colors flex items-center gap-1.5">
                          <span>{dealer.businessName || dealer.name}</span>
                          {dealer.assignedWarehouse && (
                            <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                              {dealer.assignedWarehouse.code}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#706E6B]">{dealer.name}</div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-2.5 text-[#444444]" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`mailto:${dealer.email}`}
                          className="hover:underline hover:text-[#0176D3] flex items-center gap-1"
                        >
                          <Mail size={12} className="text-slate-400" />
                          <span>{dealer.email}</span>
                        </a>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-2.5 text-[#444444] whitespace-nowrap">
                        {dealer.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone size={12} className="text-slate-400" />
                            <span>{dealer.phone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Credit Limit */}
                      <td className="py-3 px-2.5 whitespace-nowrap">
                        <div className="font-semibold text-[#181818]">{formatCurrency(creditLimit)}</div>
                        <div className="text-[10px] text-[#706E6B]">{dealer.creditDays || 30} days credit</div>
                      </td>

                      {/* Credit Used % Progress Bar */}
                      <td className="py-3 px-2.5">
                        <div className="w-full space-y-1">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500 font-medium">
                              {formatCurrency(usedCredit)}
                            </span>
                            <span className={`font-bold ${textColor}`}>{usedPercent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                              style={{ width: `${usedPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Total Orders */}
                      <td className="py-3 px-2.5 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {dealer._count?.orders ?? 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-2.5 whitespace-nowrap">
                        {dealer.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF4E5] text-[#DD7A01] border border-[#F5C278]">
                            <Clock size={10} />
                            Pending
                          </span>
                        )}
                        {dealer.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF5EE] text-[#2E844A] border border-[#C3E6CD]">
                            <CheckCircle size={10} />
                            Approved
                          </span>
                        )}
                        {dealer.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FDF3F2] text-[#BA0517] border border-[#F8D7DA]">
                            <XCircle size={10} />
                            Rejected
                          </span>
                        )}
                        {dealer.status === 'INACTIVE' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <Ban size={10} />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          {/* Pending actions */}
                          {dealer.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => openApproveModal(dealer)}
                                className="px-2 py-1 bg-[#2E844A] hover:bg-[#256B3B] text-white rounded text-[11px] font-medium transition-colors"
                                title="Approve Dealer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => openRejectModal(dealer)}
                                className="px-2 py-1 bg-[#BA0517] hover:bg-[#8E0412] text-white rounded text-[11px] font-medium transition-colors"
                                title="Reject Dealer"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {/* Approved actions */}
                          {dealer.status === 'APPROVED' && (
                            <>
                              <button
                                onClick={() => handleImpersonate(dealer)}
                                disabled={isImpersonating}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-[#EAF5FE] hover:bg-[#D4E7F9] text-[#0176D3] rounded text-[11px] font-semibold transition-colors"
                                title="Login as Dealer (Impersonate)"
                              >
                                <UserCheck size={12} />
                                <span>Login</span>
                              </button>
                              <button
                                onClick={() => handleToggleDeactivate(dealer)}
                                className="p-1 text-slate-400 hover:text-[#BA0517] rounded transition-colors"
                                title="Deactivate Dealer"
                              >
                                <Ban size={13} />
                              </button>
                            </>
                          )}

                          {/* Inactive actions */}
                          {dealer.status === 'INACTIVE' && (
                            <button
                              onClick={() => handleToggleDeactivate(dealer)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors"
                              title="Reactivate Dealer"
                            >
                              Reactivate
                            </button>
                          )}

                          {/* View details */}
                          <Link
                            href={`/dealers/${dealer.id}`}
                            className="p-1 text-slate-400 hover:text-[#0176D3] rounded transition-colors ml-1"
                            title="View Full Profile"
                          >
                            <ChevronRight size={15} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <DataPagination
          currentPage={page}
          totalPages={meta.totalPages}
          totalItems={meta.total}
          itemsPerPage={limit}
          onPageChange={setPage}
          onItemsPerPageChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </div>

      {/* APPROVE DEALER MODAL (480px) */}
      {isApproveOpen && selectedDealer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[480px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EBF5EE] text-[#2E844A] flex items-center justify-center font-bold">
                  <CheckCircle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Approve Dealer</h3>
                  <p className="text-[11px] text-[#706E6B]">
                    {selectedDealer.businessName || selectedDealer.name}
                  </p>
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
              <div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Contact:</span>
                  <span className="font-semibold text-slate-800">{selectedDealer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="text-slate-800">{selectedDealer.email}</span>
                </div>
                {selectedDealer.gstNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">GSTIN:</span>
                    <span className="font-mono text-slate-800">{selectedDealer.gstNumber}</span>
                  </div>
                )}
              </div>

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
                  placeholder="e.g. 200000"
                />
                <p className="text-[10px] text-[#706E6B] mt-0.5">Maximum credit balance allowed for orders.</p>
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
                  placeholder="e.g. 30"
                />
                <p className="text-[10px] text-[#706E6B] mt-0.5">Payment due buffer in days after dispatch.</p>
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
                <p className="text-[10px] text-[#706E6B] mt-0.5">Preferred fulfillment warehouse for this dealer.</p>
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

      {/* REJECT DEALER MODAL (480px) */}
      {isRejectOpen && selectedDealer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[480px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FDF3F2] text-[#BA0517] flex items-center justify-center font-bold">
                  <XCircle size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Reject Dealer Application</h3>
                  <p className="text-[11px] text-[#706E6B]">
                    {selectedDealer.businessName || selectedDealer.name}
                  </p>
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
              <div className="p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
                The dealer will be marked as REJECTED. They will see this reason upon attempting to sign in.
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#181818] mb-1">
                  Rejection Reason <span className="text-[#BA0517]">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Incomplete GSTIN documentation or invalid business license."
                  className="w-full px-3 py-2 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                />
                <p className="text-[10px] text-[#706E6B] mt-0.5">Minimum 3 characters required.</p>
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

      {/* ADD DEALER MODAL (560px) */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[560px] overflow-hidden border border-[#DDDBDA] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#DDDBDA] flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center font-bold">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#181818]">Add New Dealer</h3>
                  <p className="text-[11px] text-[#706E6B]">Create a dealer account (starts in PENDING status)</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDealer}>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#181818] mb-1">
                      Business / Company Name <span className="text-[#BA0517]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newDealerForm.businessName}
                      onChange={(e) => setNewDealerForm({ ...newDealerForm, businessName: e.target.value })}
                      placeholder="e.g. Apex Hardware Solutions"
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#181818] mb-1">
                      Contact Person Name <span className="text-[#BA0517]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newDealerForm.name}
                      onChange={(e) => setNewDealerForm({ ...newDealerForm, name: e.target.value })}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#181818] mb-1">
                      Email Address <span className="text-[#BA0517]">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={newDealerForm.email}
                      onChange={(e) => setNewDealerForm({ ...newDealerForm, email: e.target.value })}
                      placeholder="e.g. apex@nextrade.com"
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#181818] mb-1">
                      Phone Number (10 digits) <span className="text-[#BA0517]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      pattern="^\+?[0-9]{10,13}$"
                      value={newDealerForm.phone}
                      onChange={(e) => setNewDealerForm({ ...newDealerForm, phone: e.target.value })}
                      placeholder="e.g. 9820011223"
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181818] mb-1">
                    Business Address <span className="text-[#BA0517]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newDealerForm.businessAddress}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, businessAddress: e.target.value })}
                    placeholder="e.g. Plot 45, Andheri East, Mumbai, Maharashtra 400069"
                    className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#181818] mb-1">
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      value={newDealerForm.gstNumber}
                      onChange={(e) => setNewDealerForm({ ...newDealerForm, gstNumber: e.target.value.toUpperCase() })}
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3] uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#181818] mb-1">
                      Temporary Password <span className="text-[#BA0517]">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        readOnly
                        value={newDealerForm.password}
                        className="w-full px-3 py-1.5 text-xs border border-[#DDDBDA] rounded bg-[#F8F9FA] font-mono"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(newDealerForm.password);
                            setPasswordCopied(true);
                          } catch {
                            /* clipboard unavailable */
                          }
                        }}
                        className="px-3 py-1.5 border border-[#DDDBDA] text-xs font-medium rounded hover:bg-slate-50 whitespace-nowrap"
                      >
                        {passwordCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-[#BA0517]">
                      Save this password — it will not be shown again.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-[#F8F9FA] border-t border-[#DDDBDA] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-1.5 border border-[#DDDBDA] text-slate-700 hover:bg-white text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0176D3] hover:bg-[#014486] text-white text-xs font-semibold rounded transition-colors shadow-sm disabled:opacity-50"
                >
                  {isCreating && <Loader2 size={12} className="animate-spin" />}
                  Register Dealer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
