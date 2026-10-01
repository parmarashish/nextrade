'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  FileText,
  Boxes,
  Bell,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Landmark,
  Image as ImageIcon,
  Check,
  X,
  CreditCard,
  Info,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  SettingKey,
  CompanyInfo,
  InvoiceSettings,
  InventorySettings,
  NotificationSettings,
} from '@/features/settings/settingsApi';

type TabType = 'COMPANY' | 'INVOICE' | 'INVENTORY' | 'NOTIFICATION';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'ADMIN';

  // Role Guard
  useEffect(() => {
    if (user && !isAdmin) {
      router.push('/orders');
    }
  }, [user, isAdmin, router]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>('COMPANY');

  // Query settings from API
  const { data: settingsData, isLoading: isFetchingSettings, refetch } = useGetSettingsQuery();
  const [updateSettings, { isLoading: isUpdating }] = useUpdateSettingsMutation();

  // Local Form State
  const [companyForm, setCompanyForm] = useState<CompanyInfo>({
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    website: '',
    gstNumber: '',
    logo: '',
  });

  const [invoiceForm, setInvoiceForm] = useState<InvoiceSettings>({
    defaultCreditDays: 30,
    dueDateBuffer: 0,
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    upiId: '',
  });

  const [inventoryForm, setInventoryForm] = useState<InventorySettings>({
    defaultReorderPoint: 10,
    defaultLowStockThreshold: 5,
    allowNegativeStock: false,
  });

  const [notificationForm, setNotificationForm] = useState<NotificationSettings>({
    lowStockEmailEnabled: true,
    orderConfirmationEnabled: true,
    paymentReminderEnabled: true,
  });

  // Track initial state to detect changes
  const [initialData, setInitialData] = useState<{
    COMPANY?: CompanyInfo;
    INVOICE?: InvoiceSettings;
    INVENTORY?: InventorySettings;
    NOTIFICATION?: NotificationSettings;
  }>({});

  // Sync state once fetched
  useEffect(() => {
    if (settingsData?.data) {
      const { COMPANY_INFO, INVOICE_SETTINGS, INVENTORY_SETTINGS, NOTIFICATION_SETTINGS } =
        settingsData.data;

      if (COMPANY_INFO) {
        setCompanyForm(COMPANY_INFO);
      }
      if (INVOICE_SETTINGS) {
        setInvoiceForm(INVOICE_SETTINGS);
      }
      if (INVENTORY_SETTINGS) {
        setInventoryForm(INVENTORY_SETTINGS);
      }
      if (NOTIFICATION_SETTINGS) {
        setNotificationForm(NOTIFICATION_SETTINGS);
      }

      setInitialData({
        COMPANY: COMPANY_INFO,
        INVOICE: INVOICE_SETTINGS,
        INVENTORY: INVENTORY_SETTINGS,
        NOTIFICATION: NOTIFICATION_SETTINGS,
      });
    }
  }, [settingsData]);

  // Toast State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Track dirty state per tab
  const isCompanyDirty = JSON.stringify(companyForm) !== JSON.stringify(initialData.COMPANY);
  const isInvoiceDirty = JSON.stringify(invoiceForm) !== JSON.stringify(initialData.INVOICE);
  const isInventoryDirty = JSON.stringify(inventoryForm) !== JSON.stringify(initialData.INVENTORY);
  const isNotificationDirty = JSON.stringify(notificationForm) !== JSON.stringify(initialData.NOTIFICATION);

  const isCurrentTabDirty =
    (activeTab === 'COMPANY' && isCompanyDirty) ||
    (activeTab === 'INVOICE' && isInvoiceDirty) ||
    (activeTab === 'INVENTORY' && isInventoryDirty) ||
    (activeTab === 'NOTIFICATION' && isNotificationDirty);

  // Save Handlers
  const handleSaveTab = async (tabToSave: TabType) => {
    try {
      let key: SettingKey;
      let payload: Record<string, any>;

      switch (tabToSave) {
        case 'COMPANY':
          key = 'COMPANY_INFO';
          payload = companyForm;
          break;
        case 'INVOICE':
          key = 'INVOICE_SETTINGS';
          payload = invoiceForm;
          break;
        case 'INVENTORY':
          key = 'INVENTORY_SETTINGS';
          payload = inventoryForm;
          break;
        case 'NOTIFICATION':
          key = 'NOTIFICATION_SETTINGS';
          payload = notificationForm;
          break;
      }

      const res = await updateSettings({ key, data: payload }).unwrap();
      setToast({ type: 'success', message: res.message || 'Settings saved successfully' });
      
      // Update local initial data snapshot
      setInitialData((prev) => ({
        ...prev,
        [tabToSave]: payload,
      }));
    } catch (err: any) {
      const msg = err.data?.message || err.message || 'Failed to save settings';
      setToast({ type: 'error', message: msg });
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded shadow-lg text-xs font-medium border animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'success'
              ? 'bg-[#E3F5E9] text-[#2E844A] border-[#A3E2B5]'
              : 'bg-[#FDE8E8] text-[#BA0517] border-[#F8B4B4]'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOP BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded border border-[#DDDBDA] shadow-sm">
        <div>
          <h1 className="text-base font-bold text-[#181818]">Settings</h1>
          <p className="text-[11px] text-[#706E6B]">
            Global enterprise configurations, tax parameters, and payment preferences
          </p>
        </div>

        {/* Global Save Button */}
        <button
          onClick={() => handleSaveTab(activeTab)}
          disabled={!isCurrentTabDirty || isUpdating}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded bg-[#0176D3] text-white hover:bg-[#014486] transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isUpdating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {/* TABBED LAYOUT: Left Sidebar (4 tabs) + Right Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Left Sidebar Tabs */}
        <div className="md:col-span-4 lg:col-span-3 bg-white rounded border border-[#DDDBDA] shadow-sm p-2 space-y-1">
          {[
            { id: 'COMPANY', label: 'Company Info', icon: Building2, isDirty: isCompanyDirty },
            { id: 'INVOICE', label: 'Invoice Settings', icon: FileText, isDirty: isInvoiceDirty },
            { id: 'INVENTORY', label: 'Inventory Settings', icon: Boxes, isDirty: isInventoryDirty },
            { id: 'NOTIFICATION', label: 'Notification Settings', icon: Bell, isDirty: isNotificationDirty },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#EAF5FE] text-[#0176D3] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#0176D3]' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </div>
                {tab.isDirty && (
                  <span
                    className="w-2 h-2 rounded-full bg-[#DD7A01]"
                    title="Unsaved changes in this tab"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Panel: Active Tab Content */}
        <div className="md:col-span-8 lg:col-span-9 bg-white rounded border border-[#DDDBDA] p-5 shadow-sm space-y-6">
          {isFetchingSettings ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#0176D3] mx-auto mb-2" />
              <p className="text-xs text-[#706E6B]">Loading settings...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: COMPANY INFO */}
              {activeTab === 'COMPANY' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h2 className="text-sm font-bold text-slate-900">
                      Company Profile & Tax Information
                    </h2>
                    <p className="text-xs text-slate-500">
                      Used on official invoices, delivery notes, and dealer communication
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    {/* Company Name */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={companyForm.name}
                        onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                        placeholder="e.g. NexTrade Industrial Technologies"
                        className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                    </div>

                    {/* GST Number */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">
                        GST Number (GSTIN)
                      </label>
                      <input
                        type="text"
                        value={companyForm.gstNumber || ''}
                        onChange={(e) =>
                          setCompanyForm({ ...companyForm, gstNumber: e.target.value.toUpperCase() })
                        }
                        placeholder="e.g. 27AAACN5432B1Z8"
                        className="w-full px-3 py-1.5 font-mono border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                      <span className="text-[10px] text-slate-400">
                        Standard 15-character Indian GST identification number
                      </span>
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">
                        Official Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={companyForm.email}
                        onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                        placeholder="contact@nextrade.com"
                        className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">
                        Official Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={companyForm.phone}
                        onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                        placeholder="+91 98200 12345"
                        className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                    </div>

                    {/* Website */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="font-semibold text-slate-700">
                        Corporate Website
                      </label>
                      <input
                        type="text"
                        value={companyForm.website || ''}
                        onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                        placeholder="https://www.nextrade.com"
                        className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                    </div>

                    {/* Address Textarea */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="font-semibold text-slate-700">
                        Registered Business Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={companyForm.address}
                        onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                        placeholder="e.g. 401 Trade Avenue, Kurla West"
                        className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                    </div>

                    {/* City, State, Pincode 3-col */}
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700">City</label>
                        <input
                          type="text"
                          value={companyForm.city}
                          onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                          placeholder="Mumbai"
                          className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700">State</label>
                        <input
                          type="text"
                          value={companyForm.state}
                          onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                          placeholder="Maharashtra"
                          className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700">Pincode (6 digits)</label>
                        <input
                          type="text"
                          value={companyForm.pincode}
                          onChange={(e) => setCompanyForm({ ...companyForm, pincode: e.target.value })}
                          placeholder="400070"
                          maxLength={6}
                          className="w-full px-3 py-1.5 font-mono border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                        />
                      </div>
                    </div>

                    {/* Logo URL + Preview */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="font-semibold text-slate-700">Logo Image URL</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={companyForm.logo || ''}
                          onChange={(e) => setCompanyForm({ ...companyForm, logo: e.target.value })}
                          placeholder="https://placehold.co/200x60?text=NexTrade"
                          className="flex-1 px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                        />
                        {companyForm.logo ? (
                          <div className="w-10 h-10 border border-slate-200 rounded flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={companyForm.logo}
                              alt="Logo preview"
                              className="max-h-full max-w-full object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400 shrink-0">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Save button for this tab */}
                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleSaveTab('COMPANY')}
                      disabled={!isCompanyDirty || isUpdating}
                      className="px-4 py-2 bg-[#0176D3] text-white text-xs font-semibold rounded hover:bg-[#014486] transition-colors disabled:opacity-40"
                    >
                      Save Company Info
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: INVOICE SETTINGS */}
              {activeTab === 'INVOICE' && (
                <div className="space-y-5">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h2 className="text-sm font-bold text-slate-900">
                      Invoice & Payment Gateway Parameters
                    </h2>
                    <p className="text-xs text-slate-500">
                      Configure credit terms and official banking coordinates for NEFT/RTGS payments
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    {/* Default Credit Days */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">
                        Default Credit Days
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={invoiceForm.defaultCreditDays}
                        onChange={(e) =>
                          setInvoiceForm({
                            ...invoiceForm,
                            defaultCreditDays: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                      <span className="text-[10px] text-slate-400">
                        Default grace period assigned to new orders (usually 30 or 45 days)
                      </span>
                    </div>

                    {/* Due Date Buffer */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">
                        Due Date Buffer Days
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={invoiceForm.dueDateBuffer}
                        onChange={(e) =>
                          setInvoiceForm({
                            ...invoiceForm,
                            dueDateBuffer: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                      <span className="text-[10px] text-slate-400">
                        Grace buffer before invoices are flagged overdue
                      </span>
                    </div>

                    {/* Bank Name */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Bank Name</label>
                      <input
                        type="text"
                        value={invoiceForm.bankName}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, bankName: e.target.value })}
                        placeholder="e.g. HDFC Bank"
                        className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                    </div>

                    {/* Account Holder Name */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">
                        Account Holder Name
                      </label>
                      <input
                        type="text"
                        value={invoiceForm.accountHolderName}
                        onChange={(e) =>
                          setInvoiceForm({ ...invoiceForm, accountHolderName: e.target.value })
                        }
                        placeholder="NexTrade Industrial Technologies"
                        className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                    </div>

                    {/* Account Number */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Account Number</label>
                      <input
                        type="text"
                        value={invoiceForm.accountNumber}
                        onChange={(e) =>
                          setInvoiceForm({ ...invoiceForm, accountNumber: e.target.value })
                        }
                        placeholder="50200088991122"
                        className="w-full px-3 py-1.5 font-mono border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                    </div>

                    {/* IFSC Code */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">IFSC Code</label>
                      <input
                        type="text"
                        value={invoiceForm.ifscCode}
                        onChange={(e) =>
                          setInvoiceForm({ ...invoiceForm, ifscCode: e.target.value.toUpperCase() })
                        }
                        placeholder="HDFC0001234"
                        className="w-full px-3 py-1.5 font-mono border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                    </div>

                    {/* UPI ID */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="font-semibold text-slate-700">Official UPI ID</label>
                      <input
                        type="text"
                        value={invoiceForm.upiId || ''}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, upiId: e.target.value })}
                        placeholder="nextrade@hdfcbank"
                        className="w-full px-3 py-1.5 font-mono border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                    </div>
                  </div>

                  {/* Live Payment Details Preview Card */}
                  <div className="bg-[#F8F9FA] rounded border border-slate-200 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                      <Landmark className="w-4 h-4 text-[#0176D3]" />
                      <span>Payment Details Preview (as displayed on invoices)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">BANK</span>
                        <span className="font-bold text-slate-800">
                          {invoiceForm.bankName || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">ACCOUNT NO</span>
                        <span className="font-mono font-bold text-slate-800">
                          {invoiceForm.accountNumber || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">IFSC</span>
                        <span className="font-mono font-bold text-slate-800">
                          {invoiceForm.ifscCode || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">UPI</span>
                        <span className="font-mono font-bold text-[#0176D3]">
                          {invoiceForm.upiId || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Save button for this tab */}
                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleSaveTab('INVOICE')}
                      disabled={!isInvoiceDirty || isUpdating}
                      className="px-4 py-2 bg-[#0176D3] text-white text-xs font-semibold rounded hover:bg-[#014486] transition-colors disabled:opacity-40"
                    >
                      Save Invoice Settings
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: INVENTORY SETTINGS */}
              {activeTab === 'INVENTORY' && (
                <div className="space-y-5">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h2 className="text-sm font-bold text-slate-900">
                      Inventory Control & Stock Rules
                    </h2>
                    <p className="text-xs text-slate-500">
                      Warehouse reorder thresholds and safety stock handling
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    {/* Default Reorder Point */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">
                        Default Reorder Point
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={inventoryForm.defaultReorderPoint}
                        onChange={(e) =>
                          setInventoryForm({
                            ...inventoryForm,
                            defaultReorderPoint: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                      <span className="text-[10px] text-slate-400">
                        New warehouses will use this as default replenishment threshold
                      </span>
                    </div>

                    {/* Default Low Stock Threshold */}
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">
                        Default Low Stock Threshold
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={inventoryForm.defaultLowStockThreshold}
                        onChange={(e) =>
                          setInventoryForm({
                            ...inventoryForm,
                            defaultLowStockThreshold: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-1.5 border border-[#DDDBDA] rounded focus:outline-none focus:border-[#0176D3]"
                      />
                      <span className="text-[10px] text-slate-400">
                        Triggers low stock warnings across product tables and dashboard KPIs
                      </span>
                    </div>

                    {/* Allow Negative Stock Toggle */}
                    <div className="sm:col-span-2 pt-2">
                      <div className="flex items-center justify-between p-3.5 rounded border border-[#DDDBDA] bg-slate-50">
                        <div>
                          <div className="font-bold text-slate-800">Allow Negative Stock</div>
                          <div className="text-[11px] text-slate-500">
                            Allow order confirmation and dispatch even when inventory is 0
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={inventoryForm.allowNegativeStock}
                            onChange={(e) =>
                              setInventoryForm({
                                ...inventoryForm,
                                allowNegativeStock: e.target.checked,
                              })
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0176D3]"></div>
                        </label>
                      </div>

                      {/* Warning box if enabled */}
                      {inventoryForm.allowNegativeStock && (
                        <div className="mt-2.5 p-3 rounded bg-[#FEF3D6] border border-[#FAD889] text-[#DD7A01] text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>
                            ⚠️ Enabling this allows orders even when stock is zero. Not recommended
                            for physical warehouses as it can cause backorder discrepancies.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save button for this tab */}
                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleSaveTab('INVENTORY')}
                      disabled={!isInventoryDirty || isUpdating}
                      className="px-4 py-2 bg-[#0176D3] text-white text-xs font-semibold rounded hover:bg-[#014486] transition-colors disabled:opacity-40"
                    >
                      Save Inventory Settings
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: NOTIFICATION SETTINGS */}
              {activeTab === 'NOTIFICATION' && (
                <div className="space-y-5">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h2 className="text-sm font-bold text-slate-900">
                      Automated Notification Preferences
                    </h2>
                    <p className="text-xs text-slate-500">
                      Configure automated operational alerts and dealer reminder dispatches
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Toggle 1 */}
                    <div className="flex items-center justify-between p-3.5 rounded border border-[#DDDBDA] bg-slate-50">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">
                          Low Stock Email Alerts
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Send email when items fall below reorder point
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationForm.lowStockEmailEnabled}
                          onChange={(e) =>
                            setNotificationForm({
                              ...notificationForm,
                              lowStockEmailEnabled: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0176D3]"></div>
                      </label>
                    </div>

                    {/* Toggle 2 */}
                    <div className="flex items-center justify-between p-3.5 rounded border border-[#DDDBDA] bg-slate-50">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">
                          Order Confirmation Alerts
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Send confirmation email on new order placement
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationForm.orderConfirmationEnabled}
                          onChange={(e) =>
                            setNotificationForm({
                              ...notificationForm,
                              orderConfirmationEnabled: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0176D3]"></div>
                      </label>
                    </div>

                    {/* Toggle 3 */}
                    <div className="flex items-center justify-between p-3.5 rounded border border-[#DDDBDA] bg-slate-50">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">
                          Payment Reminder Alerts
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Send reminders for overdue invoices
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationForm.paymentReminderEnabled}
                          onChange={(e) =>
                            setNotificationForm({
                              ...notificationForm,
                              paymentReminderEnabled: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0176D3]"></div>
                      </label>
                    </div>

                    {/* Informational note */}
                    <div className="p-3 rounded bg-blue-50 border border-blue-100 text-[#0176D3] text-xs flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>
                        Email sending integration coming soon — toggles save preferences for future
                        use.
                      </span>
                    </div>
                  </div>

                  {/* Save button for this tab */}
                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleSaveTab('NOTIFICATION')}
                      disabled={!isNotificationDirty || isUpdating}
                      className="px-4 py-2 bg-[#0176D3] text-white text-xs font-semibold rounded hover:bg-[#014486] transition-colors disabled:opacity-40"
                    >
                      Save Notification Settings
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
