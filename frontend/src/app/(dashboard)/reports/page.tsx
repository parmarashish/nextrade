'use client';

import { InfoTip } from '@/components/ui/info-tip';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart2,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  DollarSign,
  Package,
  Boxes,
  Users,
  Calendar,
  Download,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Award,
  ChevronRight,
  Filter,
  Check,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAppSelector } from '@/store/hooks';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';
import {
  useGetSummaryQuery,
  useGetSalesReportQuery,
  useGetCategoriesReportQuery,
  useGetDealersReportQuery,
  useGetInventoryReportQuery,
} from '@/features/reports/reportsApi';
import { toast } from '@/components/ui/toast';

import { DataPagination, DEFAULT_PAGE_SIZE } from '@/components/ui/data-pagination';
type DatePreset = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'CUSTOM';

const CATEGORY_COLORS = [
  '#0176D3',
  '#1B96FF',
  '#00A1E0',
  '#06A59A',
  '#3296ED',
  '#DD7A01',
  '#706E6B',
  '#BA0517',
];

// Y-axis label for the products chart: truncated text with the full name on hover (native SVG title).
function ProductTick({ x, y, payload, names, fullNames }: any) {
  const idx = names.indexOf(payload?.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{fullNames[idx] ?? payload?.value}</title>
      <text x={-6} y={0} dy={4} textAnchor="end" fontSize={10.5} fill="#181818">
        {payload?.value}
      </text>
    </g>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const { user, token } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === 'ADMIN';

  // Role Guard: Redirect dealers to /orders
  useEffect(() => {
    if (user && !isAdmin) {
      router.push('/orders');
    }
  }, [user, isAdmin, router]);

  // Hydration safety for Recharts
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Date Range Filter State
  const [preset, setPreset] = useState<DatePreset>('LAST_30_DAYS');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exportingType, setExportingType] = useState<string | null>(null);

  // Calculate Date Boundaries based on preset
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    const toIsoDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'CUSTOM') {
      return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    }

    if (preset === 'TODAY') {
      const todayStr = toIsoDate(now);
      return { dateFrom: todayStr, dateTo: todayStr };
    }

    if (preset === 'THIS_WEEK') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      return { dateFrom: toIsoDate(monday), dateTo: toIsoDate(now) };
    }

    if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: toIsoDate(firstDay), dateTo: toIsoDate(now) };
    }

    if (preset === 'LAST_90_DAYS') {
      const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { dateFrom: toIsoDate(past90), dateTo: toIsoDate(now) };
    }

    // Default: LAST_30_DAYS
    const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { dateFrom: toIsoDate(past30), dateTo: toIsoDate(now) };
  }, [preset, customFrom, customTo]);

  // Queries
  const { data: summaryData, isLoading: isSummaryLoading } = useGetSummaryQuery();
  const { data: salesData, isLoading: isSalesLoading } = useGetSalesReportQuery({ dateFrom, dateTo });
  const { data: categoriesData, isLoading: isCategoriesLoading } = useGetCategoriesReportQuery({ dateFrom, dateTo });
  const { data: dealersData, isLoading: isDealersLoading } = useGetDealersReportQuery({ dateFrom, dateTo });
  const { data: inventoryData, isLoading: isInventoryLoading } = useGetInventoryReportQuery();

  const summary = summaryData?.data;
  const sales = salesData?.data;
  const categories = categoriesData?.data || [];
  const dealers = dealersData?.data || [];
  const inventory = inventoryData?.data;

  // KPI Calculations
  const topCategory = categories.length > 0 ? categories[0] : null;

  // Pie chart data: Top 5 categories + Others
  const categoryDonutData = useMemo(() => {
    if (!categories.length) return [];
    if (categories.length <= 5) {
      return categories.map((c) => ({
        name: c.categoryName,
        value: c.totalRevenue,
      }));
    }
    const top5 = categories.slice(0, 5).map((c) => ({
      name: c.categoryName,
      value: c.totalRevenue,
    }));
    const othersRevenue = categories.slice(5).reduce((sum, c) => sum + c.totalRevenue, 0);
    top5.push({ name: 'Others', value: Number(othersRevenue.toFixed(2)) });
    return top5;
  }, [categories]);

  // Top 10 Products for Bar Chart
  const topProductsData = useMemo(() => {
    if (sales?.topProducts && sales.topProducts.length > 0) {
      return [...sales.topProducts]
        .slice(0, 10)
        .reverse()
        .map((p) => ({
          name: p.productName.length > 26 ? p.productName.slice(0, 25) + '…' : p.productName,
          fullName: p.productName,
          revenue: p.revenue,
          unitsSold: p.unitsSold,
        }));
    }
    if (inventory?.topProductsByValue) {
      return [...inventory.topProductsByValue]
        .slice(0, 10)
        .reverse()
        .map((p) => ({
          name: p.productName.length > 26 ? p.productName.slice(0, 25) + '…' : p.productName,
          fullName: p.productName,
          revenue: p.stockValue,
          unitsSold: p.totalQuantity,
        }));
    }
    return [];
  }, [sales, inventory]);

  // CSV Export Handler
  const handleExportCsv = async (type: 'sales' | 'dealers' | 'inventory') => {
    try {
      setExportingType(type);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const url = `${baseUrl}/reports/${type}/export?${params.toString()}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`Failed to export ${type} report`);

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const dateSuffix = dateFrom && dateTo ? `_${dateFrom}_to_${dateTo}` : `_${new Date().toISOString().slice(0, 10)}`;
      a.download = `${type}_report${dateSuffix}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
    } catch (err: any) {
      toast.error(err.message || 'Error exporting CSV');
    } finally {
      setExportingType(null);
    }
  };

  // Client-side pagination for the dealers table
  const [dealerPage, setDealerPage] = useState(1);
  const [dealerLimit, setDealerLimit] = useState(DEFAULT_PAGE_SIZE);
  const dealerTotalPages = Math.max(1, Math.ceil(dealers.length / dealerLimit));
  const pagedDealers = dealers.slice((dealerPage - 1) * dealerLimit, dealerPage * dealerLimit);
  useEffect(() => {
    setDealerPage(1);
  }, [dealers.length]);

  if (!isAdmin) {
    return null; // Will redirect via useEffect
  }

  // Helper for compact Y-axis currency
  const formatYAxis = formatCompactCurrency;

  return (
    <div className="space-y-4 pb-12">
      {/* TOP BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded border border-[#DDDBDA] shadow-sm">
        {/* Left: Heading */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#181818]">
              Reports & Analytics
            </h1>
            <p className="text-[11px] text-[#706E6B]">
              Comprehensive B2B performance, sales revenue, and inventory valuation
            </p>
          </div>
        </div>

        {/* Right: Date Range Presets & CSV Exports */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Pills */}
          <div className="inline-flex rounded border border-[#DDDBDA] bg-slate-50 p-0.5 text-xs font-medium">
            {(
              [
                { label: 'Today', key: 'TODAY' },
                { label: 'This Week', key: 'THIS_WEEK' },
                { label: 'This Month', key: 'THIS_MONTH' },
                { label: 'Last 30 Days', key: 'LAST_30_DAYS' },
                { label: 'Last 90 Days', key: 'LAST_90_DAYS' },
                { label: 'Custom', key: 'CUSTOM' },
              ] as const
            ).map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  preset === p.key
                    ? 'bg-white text-[#0176D3] font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs if Custom selected */}
          {preset === 'CUSTOM' && (
            <div className="flex items-center gap-1.5 bg-white border border-[#DDDBDA] rounded px-2 py-1 text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-transparent focus:outline-none text-slate-700"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-transparent focus:outline-none text-slate-700"
              />
            </div>
          )}

          {/* CSV Export Dropdown / Buttons */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              onClick={() => handleExportCsv('sales')}
              disabled={Boolean(exportingType)}
              title="Export Sales CSV"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-[#DDDBDA] rounded transition-colors disabled:opacity-50"
            >
              {exportingType === 'sales' ? (
                <Loader2 className="w-3 h-3 animate-spin text-[#0176D3]" />
              ) : (
                <Download className="w-3 h-3 text-slate-500" />
              )}
              <span>Sales CSV</span>
            </button>

            <button
              onClick={() => handleExportCsv('dealers')}
              disabled={Boolean(exportingType)}
              title="Export Dealers CSV"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-[#DDDBDA] rounded transition-colors disabled:opacity-50"
            >
              {exportingType === 'dealers' ? (
                <Loader2 className="w-3 h-3 animate-spin text-[#0176D3]" />
              ) : (
                <Download className="w-3 h-3 text-slate-500" />
              )}
              <span>Dealers CSV</span>
            </button>

            <button
              onClick={() => handleExportCsv('inventory')}
              disabled={Boolean(exportingType)}
              title="Export Inventory CSV"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-[#DDDBDA] rounded transition-colors disabled:opacity-50"
            >
              {exportingType === 'inventory' ? (
                <Loader2 className="w-3 h-3 animate-spin text-[#0176D3]" />
              ) : (
                <Download className="w-3 h-3 text-slate-500" />
              )}
              <span>Inventory CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOP ROW — 4 KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Revenue */}
        <div className="bg-white rounded border border-[#DDDBDA] p-3.5 shadow-sm">
          {isSalesLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-6 w-32 bg-slate-300 rounded" />
              <div className="h-3 w-28 bg-slate-100 rounded" />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between text-[#706E6B] text-[11px] font-medium uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1">
                  Total Revenue
                  <InfoTip text="Revenue from orders with DELIVERED status in the selected period" />
                </span>
                <DollarSign className="w-3.5 h-3.5 text-[#0176D3]" />
              </div>
              <div className="text-xl font-bold text-[#181818]">
                {formatCurrency(sales?.totalRevenue || 0)}
              </div>
              <div className="text-[11px] text-[#706E6B]">delivered orders in period</div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                {summary && summary.revenueChange == null ? (
                  <span className="text-[#706E6B] font-medium">n/a</span>
                ) : summary && (summary.revenueChange ?? 0) >= 0 ? (
                  <span className="flex items-center text-[#2E844A] font-semibold">
                    <TrendingUp className="w-3 h-3 mr-0.5" />+{summary.revenueChange}%
                  </span>
                ) : summary ? (
                  <span className="flex items-center text-[#BA0517] font-semibold">
                    <TrendingDown className="w-3 h-3 mr-0.5" />{summary.revenueChange}%
                  </span>
                ) : null}
                <span className="text-[#706E6B]">vs previous period</span>
              </div>
            </div>
          )}
        </div>

        {/* KPI 2: Total Orders */}
        <div className="bg-white rounded border border-[#DDDBDA] p-3.5 shadow-sm">
          {isSalesLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-6 w-16 bg-slate-300 rounded" />
              <div className="h-3 w-28 bg-slate-100 rounded" />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between text-[#706E6B] text-[11px] font-medium uppercase tracking-wider mb-1">
                <span>Total Orders</span>
                <ShoppingCart className="w-3.5 h-3.5 text-[#0176D3]" />
              </div>
              <div className="text-xl font-bold text-[#181818]">
                {sales?.totalOrders || 0}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                {summary && summary.ordersChange == null ? (
                  <span className="text-[#706E6B] font-medium">n/a</span>
                ) : summary && (summary.ordersChange ?? 0) >= 0 ? (
                  <span className="flex items-center text-[#2E844A] font-semibold">
                    <TrendingUp className="w-3 h-3 mr-0.5" />+{summary.ordersChange}%
                  </span>
                ) : summary ? (
                  <span className="flex items-center text-[#BA0517] font-semibold">
                    <TrendingDown className="w-3 h-3 mr-0.5" />{summary.ordersChange}%
                  </span>
                ) : null}
                <span className="text-[#706E6B]">vs previous period</span>
              </div>
            </div>
          )}
        </div>

        {/* KPI 3: Avg Order Value */}
        <div className="bg-white rounded border border-[#DDDBDA] p-3.5 shadow-sm">
          {isSalesLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-6 w-28 bg-slate-300 rounded" />
              <div className="h-3 w-28 bg-slate-100 rounded" />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between text-[#706E6B] text-[11px] font-medium uppercase tracking-wider mb-1">
                <span>Avg Order Value</span>
                <TrendingUp className="w-3.5 h-3.5 text-[#0176D3]" />
              </div>
              <div className="text-xl font-bold text-[#181818]">
                {formatCurrency(sales?.avgOrderValue || 0)}
              </div>
              <div className="text-[11px] text-[#706E6B] mt-1">
                Revenue ÷ orders
              </div>
            </div>
          )}
        </div>

        {/* KPI 4: Top Category */}
        <div className="bg-white rounded border border-[#DDDBDA] p-3.5 shadow-sm">
          {isCategoriesLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-6 w-32 bg-slate-300 rounded" />
              <div className="h-3 w-24 bg-slate-100 rounded" />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between text-[#706E6B] text-[11px] font-medium uppercase tracking-wider mb-1">
                <span>Top Category</span>
                <Award className="w-3.5 h-3.5 text-[#DD7A01]" />
              </div>
              <div className="text-base font-bold text-[#181818] truncate" title={topCategory?.categoryName || '—'}>
                {topCategory?.categoryName || '—'}
              </div>
              <div className="text-[11px] text-[#706E6B] mt-1">
                Revenue: <strong className="text-slate-900">{formatCurrency(topCategory?.totalRevenue || 0)}</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CHARTS ROW 1: Revenue Trend (60%) + Sales by Category (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left: Revenue Trend (60% -> col-span-7) */}
        <div className="lg:col-span-7 bg-white rounded border border-[#DDDBDA] p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Revenue Trend
              </h2>
              <p className="text-[10px] text-slate-500">
                Monthly delivered revenue and sales order volume
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0176D3]" />
                Revenue (₹)
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            {!isMounted || isSalesLoading ? (
              <div className="w-full h-full bg-slate-50 rounded animate-pulse flex items-center justify-center text-xs text-slate-400">
                Loading revenue trend chart...
              </div>
            ) : sales?.revenueByMonth && sales.revenueByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={sales.revenueByMonth}
                  margin={{ top: 10, right: 15, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0176D3" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0176D3" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#706E6B' }}
                    axisLine={{ stroke: '#DDDBDA' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 10, fill: '#706E6B' }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Revenue']}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #DDDBDA',
                      borderRadius: '4px',
                      fontSize: '11px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0176D3"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                    activeDot={{ r: 4, stroke: '#014486', strokeWidth: 1 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                No revenue records found for selected period
              </div>
            )}
          </div>
        </div>

        {/* Right: Sales by Category (40% -> col-span-5) */}
        <div className="lg:col-span-5 bg-white rounded border border-[#DDDBDA] p-4 shadow-sm flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Sales by Category
            </h2>
            <p className="text-[10px] text-slate-500">
              Top revenue generating product categories
            </p>
          </div>

          <div className="h-[280px] w-full flex items-center justify-center">
            {!isMounted || isCategoriesLoading ? (
              <div className="w-full h-full bg-slate-50 rounded animate-pulse flex items-center justify-center text-xs text-slate-400">
                Loading category chart...
              </div>
            ) : categoryDonutData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDonutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {categoryDonutData.map((_entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Revenue']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #DDDBDA',
                      borderRadius: '4px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    layout="horizontal"
                    iconSize={8}
                    formatter={(val, entry: any) => {
                      const item = categoryDonutData.find((d) => d.name === val);
                      return (
                        <span className="text-[10px] text-slate-700 font-medium">
                          {val} ({formatCurrency(item?.value || 0)})
                        </span>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400 text-center py-12">
                No category sales recorded
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2: Top 10 Products (50%) + Top Dealers Performance (50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Left: Top 10 Products (Horizontal Bar Chart) */}
        <div className="bg-white rounded border border-[#DDDBDA] p-4 shadow-sm flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Top Products by Revenue
            </h2>
            <p className="text-[10px] text-slate-500">
              Highest contributing products in selected date range
            </p>
          </div>

          <div className="w-full" style={{ height: Math.max(310, topProductsData.length * 35) }}>
            {!isMounted || isSalesLoading ? (
              <div className="w-full h-full bg-slate-50 rounded animate-pulse flex items-center justify-center text-xs text-slate-400">
                Loading products chart...
              </div>
            ) : topProductsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProductsData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis
                    type="number"
                    tickFormatter={formatYAxis}
                    tick={{ fontSize: 10, fill: '#706E6B' }}
                    axisLine={{ stroke: '#DDDBDA' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={<ProductTick fullNames={topProductsData.map((d) => d.fullName)} names={topProductsData.map((d) => d.name)} />}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    width={175}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white border border-[#DDDBDA] p-2 rounded shadow-md text-xs">
                            <p className="font-bold text-slate-900 mb-0.5">{data.fullName}</p>
                            <p className="text-slate-600">
                              Revenue: <strong className="text-[#0176D3]">{formatCurrency(data.revenue)}</strong>
                            </p>
                            <p className="text-slate-500 text-[10px]">
                              Units Sold: <strong>{data.unitsSold}</strong>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="revenue" fill="#0176D3" radius={[0, 3, 3, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                No product sales records found
              </div>
            )}
          </div>
        </div>

        {/* Right: Top Dealers Performance (Table) */}
        <div className="bg-white rounded border border-[#DDDBDA] p-4 shadow-sm flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-2 mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Top Dealers Performance
              </h2>
              <p className="text-[10px] text-slate-500">
                Order frequency, cumulative sales, and credit utilization
              </p>
            </div>
            <Link
              href="/dealers"
              className="text-xs text-[#0176D3] hover:underline font-medium inline-flex items-center gap-1"
            >
              All Dealers <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto min-h-[310px]">
            {isDealersLoading ? (
              <div className="space-y-3 pt-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : dealers.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-[#DDDBDA] text-[#706E6B] font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-2 text-center w-8">Rank</th>
                    <th className="py-2 px-2">Dealer</th>
                    <th className="py-2 px-2 text-center">Orders</th>
                    <th className="py-2 px-2 text-right">Revenue</th>
                    <th className="py-2 px-2 text-right">Avg Order</th>
                    <th className="py-2 px-2 text-right">Credit Util%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDDBDA]">
                  {pagedDealers.map((d, index) => {
                    const rank = (dealerPage - 1) * dealerLimit + index + 1;
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
                    const util = d.creditUtilization;
                    const utilColor =
                      util > 80 ? 'bg-[#BA0517]' : util >= 50 ? 'bg-[#DD7A01]' : 'bg-[#2E844A]';

                    return (
                      <tr key={d.dealerId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-2 text-center font-semibold text-xs">
                          {medal}
                        </td>
                        <td className="py-2 px-2">
                          <Link
                            href={`/dealers/${d.dealerId}`}
                            className="font-bold text-slate-800 hover:text-[#0176D3] transition-colors truncate block max-w-[130px]"
                            title={d.businessName}
                          >
                            {d.businessName}
                          </Link>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {d.dealerName}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {d.totalOrders}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-semibold text-slate-900">
                          {formatCurrency(d.totalRevenue)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600">
                          {formatCurrency(d.avgOrderValue)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-mono text-[11px] font-semibold text-slate-700 w-10 text-right">
                              {util.toFixed(1)}%
                            </span>
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden shrink-0">
                              <div
                                className={`h-full ${utilColor}`}
                                style={{ width: `${Math.min(util, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No dealer performance data available
              </div>
            )}
          </div>
          <DataPagination
            currentPage={dealerPage}
            totalPages={dealerTotalPages}
            totalItems={dealers.length}
            itemsPerPage={dealerLimit}
            onPageChange={setDealerPage}
            onItemsPerPageChange={(n) => {
              setDealerLimit(n);
              setDealerPage(1);
            }}
          />
        </div>
      </div>

      {/* INVENTORY SNAPSHOT (FULL WIDTH) */}
      <div className="bg-white rounded border border-[#DDDBDA] p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#0176D3]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Inventory Snapshot
            </h2>
          </div>
          <Link
            href="/inventory"
            className="text-xs text-[#0176D3] hover:underline font-medium inline-flex items-center gap-1"
          >
            View Full Inventory <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 4 Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#F8F9FA] rounded p-3 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Total Products
            </span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {inventory?.totalProducts || 0}
            </div>
          </div>

          <div className="bg-[#F8F9FA] rounded p-3 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Total Variants
            </span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {inventory?.totalVariants || 0}
            </div>
          </div>

          <div className="bg-[#F8F9FA] rounded p-3 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Total Stock Value
            </span>
            <div className="text-lg font-bold text-[#0176D3] mt-0.5">
              {formatCurrency(inventory?.totalStockValue || 0)}
            </div>
          </div>

          <div className="bg-[#F8F9FA] rounded p-3 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Low Stock Alerts
            </span>
            <div
              className={`text-lg font-bold mt-0.5 ${
                (inventory?.lowStockCount || 0) > 0
                  ? 'text-[#DD7A01]'
                  : 'text-slate-900'
              }`}
            >
              {inventory?.lowStockCount || 0}
            </div>
          </div>
        </div>

        {/* Stock by Warehouse mini-table */}
        {inventory?.stockByWarehouse && inventory.stockByWarehouse.length > 0 && (
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-2">
              Warehouse Valuation Breakdown
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F4F6F9] border-b border-[#DDDBDA] text-[#706E6B] font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2 px-3">Warehouse Hub</th>
                    <th className="py-2 px-3 text-center">Code</th>
                    <th className="py-2 px-3 text-center">Active Variants</th>
                    <th className="py-2 px-3 text-right">Physical Stock Units</th>
                    <th className="py-2 px-3 text-right">Stock Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDDBDA]">
                  {inventory.stockByWarehouse.map((wh) => (
                    <tr key={wh.warehouseId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {wh.name}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {wh.code}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600">
                        {wh.totalVariants}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-slate-800">
                        {wh.totalStock.toLocaleString('en-IN')} units
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(wh.stockValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
