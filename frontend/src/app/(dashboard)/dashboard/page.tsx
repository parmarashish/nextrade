'use client';

import { InfoTip } from '@/components/ui/info-tip';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Clock,
  AlertTriangle,
  ArrowRight,
  Package,
  CheckCircle2,
  Boxes,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { formatCurrency, formatDate, formatCompactCurrency } from '@/lib/utils';
import { useGetSummaryQuery, useGetSalesReportQuery, OrderStatusType } from '@/features/reports/reportsApi';
import { useGetOrdersQuery, RecentOrder } from '@/features/orders/ordersApi';
import { useGetInventoryAlertsQuery, StockAlert } from '@/features/inventory/inventoryApi';

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; text: string; border: string }
> = {
  PENDING: {
    label: 'Pending',
    color: '#DD7A01',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: '#0176D3',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
  },
  PROCESSING: {
    label: 'Processing',
    color: '#7B61FF',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
  },
  PARTIALLY_DISPATCHED: {
    label: 'Partial Dispatch',
    color: '#9333EA',
    bg: 'bg-fuchsia-50',
    text: 'text-fuchsia-800',
    border: 'border-fuchsia-200',
  },
  DISPATCHED: {
    label: 'Dispatched',
    color: '#06B6D4',
    bg: 'bg-cyan-50',
    text: 'text-cyan-800',
    border: 'border-cyan-200',
  },
  DELIVERED: {
    label: 'Delivered',
    color: '#2E844A',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: '#BA0517',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
  },
};

export default function DashboardPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch KPI Summary
  const { data: summaryData, isLoading: isSummaryLoading } = useGetSummaryQuery();
  const summary = summaryData?.data;

  // Fetch Sales & Charts Data
  const { data: salesData, isLoading: isSalesLoading } = useGetSalesReportQuery();
  const sales = salesData?.data;

  // Fetch Recent 5 Orders
  const { data: ordersData, isLoading: isOrdersLoading } = useGetOrdersQuery({ limit: 5 });
  const recentOrders = ordersData?.data || [];

  // Fetch Low Stock Alerts
  const { data: alertsData, isLoading: isAlertsLoading } = useGetInventoryAlertsQuery();
  const stockAlerts = alertsData?.data || [];

  // Formatter for compact Y-axis values in Bar Chart
  const formatYAxis = formatCompactCurrency;

  // Filter donut chart data to only include statuses with orders > 0
  const donutData = (sales?.revenueByStatus || [])
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: STATUS_CONFIG[item.status]?.label || item.status,
      value: item.count,
      statusKey: item.status,
      color: STATUS_CONFIG[item.status]?.color || '#706E6B',
      totalValue: item.totalValue,
    }));

  return (
    <div className="space-y-6 pb-8">
      {/* Page Heading & Quick Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#181818] tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-xs text-[#706E6B] mt-0.5">
            Real-time business performance, order dispatch pipelines, and warehouse inventory health
          </p>
        </div>
      </div>

      {/* ─── TOP ROW: 4 KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Revenue (this month) */}
        {isSummaryLoading ? (
          <KPICardSkeleton />
        ) : (
          <div className="bg-white p-5 rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#706E6B] flex items-center gap-1">
                  Total Revenue
                  <InfoTip text="Revenue from orders with DELIVERED status" />
                </p>
                <h3 className="text-2xl font-bold text-[#181818] mt-1 tracking-tight">
                  {formatCurrency(summary?.totalRevenue ?? 0)}
                </h3>
                <p className="text-[11px] text-[#706E6B] mt-0.5">from delivered orders this month</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#EAF5FE] flex items-center justify-center shrink-0">
                <TrendingUp size={20} className="text-[#0176D3]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-medium">
                {summary?.revenueChange == null ? (
                  <span className="text-[#706E6B] font-medium">n/a</span>
                ) : (summary?.revenueChange ?? 0) >= 0 ? (
                  <span className="flex items-center text-[#2E844A]">
                    <TrendingUp size={14} className="mr-0.5" />
                    +{summary?.revenueChange}%
                  </span>
                ) : (
                  <span className="flex items-center text-[#BA0517]">
                    <TrendingDown size={14} className="mr-0.5" />
                    {summary?.revenueChange}%
                  </span>
                )}
                <span className="text-[#706E6B]">vs last month</span>
              </div>
            </div>
          </div>
        )}

        {/* KPI 2: Total Orders (this month) */}
        {isSummaryLoading ? (
          <KPICardSkeleton />
        ) : (
          <div className="bg-white p-5 rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#706E6B]">
                  Total Orders
                </p>
                <h3 className="text-2xl font-bold text-[#181818] mt-1 tracking-tight">
                  {summary?.totalOrders ?? 0}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#EAF5FE] flex items-center justify-center shrink-0">
                <ShoppingCart size={20} className="text-[#0176D3]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-medium">
                {summary?.ordersChange == null ? (
                  <span className="text-[#706E6B] font-medium">n/a</span>
                ) : (summary?.ordersChange ?? 0) >= 0 ? (
                  <span className="flex items-center text-[#2E844A]">
                    <TrendingUp size={14} className="mr-0.5" />
                    +{summary?.ordersChange}%
                  </span>
                ) : (
                  <span className="flex items-center text-[#BA0517]">
                    <TrendingDown size={14} className="mr-0.5" />
                    {summary?.ordersChange}%
                  </span>
                )}
                <span className="text-[#706E6B]">vs last month</span>
              </div>
            </div>
          </div>
        )}

        {/* KPI 3: Pending Orders */}
        {isSummaryLoading ? (
          <KPICardSkeleton />
        ) : (
          <div className="bg-white p-5 rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#706E6B]">
                  Pending Orders
                </p>
                <h3
                  className={`text-2xl font-bold mt-1 tracking-tight ${
                    (summary?.pendingOrders ?? 0) > 0 ? 'text-[#DD7A01]' : 'text-[#181818]'
                  }`}
                >
                  {summary?.pendingOrders ?? 0}
                </h3>
              </div>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  (summary?.pendingOrders ?? 0) > 0 ? 'bg-amber-50' : 'bg-slate-100'
                }`}
              >
                <Clock
                  size={20}
                  className={(summary?.pendingOrders ?? 0) > 0 ? 'text-[#DD7A01]' : 'text-[#706E6B]'}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[#706E6B]">awaiting confirmation</span>
              <Link
                href="/orders?status=PENDING"
                className="text-[11px] font-semibold text-[#0176D3] hover:underline flex items-center gap-0.5"
              >
                Review
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        )}

        {/* KPI 4: Low Stock Alerts (Clickable to /inventory?filter=low_stock) */}
        {isSummaryLoading ? (
          <KPICardSkeleton />
        ) : (
          <div
            onClick={() => router.push('/inventory?filter=low_stock')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') router.push('/inventory?filter=low_stock');
            }}
            className="bg-white p-5 rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] flex flex-col justify-between cursor-pointer hover:border-[#0176D3] hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#706E6B] group-hover:text-[#0176D3] transition-colors">
                  Low Stock Alerts
                </p>
                <h3
                  className={`text-2xl font-bold mt-1 tracking-tight ${
                    (summary?.lowStockAlerts ?? 0) > 0 ? 'text-[#BA0517]' : 'text-[#2E844A]'
                  }`}
                >
                  {summary?.lowStockAlerts ?? 0}
                </h3>
              </div>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                  (summary?.lowStockAlerts ?? 0) > 0 ? 'bg-red-50' : 'bg-emerald-50'
                }`}
              >
                <AlertTriangle
                  size={20}
                  className={(summary?.lowStockAlerts ?? 0) > 0 ? 'text-[#BA0517]' : 'text-[#2E844A]'}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-[#706E6B]">items below reorder point</span>
              <span className="text-[11px] font-semibold text-[#0176D3] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                View Stock
                <ArrowRight size={12} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── CHARTS ROW: Revenue by Month (60%) & Orders by Status (40%) ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Revenue by Month (60% -> 7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#181818]">Revenue by Month</h2>
              <p className="text-xs text-[#706E6B]">Monthly revenue trends over the last 12 months</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#EAF5FE] text-[#0176D3]">
              DELIVERED Orders
            </span>
          </div>

          <div className="h-[280px] w-full">
            {isSalesLoading || !isMounted ? (
              <div className="h-full bg-slate-50 animate-pulse rounded flex items-center justify-center text-xs text-slate-400">
                Loading revenue chart...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sales?.revenueByMonth || []}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECEBE9" />
                  <XAxis
                    dataKey="label"
                    stroke="#706E6B"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => {
                      // Compact month name e.g. "Sep 2026" -> "Sep"
                      return typeof val === 'string' ? val.split(' ')[0] : val;
                    }}
                  />
                  <YAxis
                    stroke="#706E6B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatYAxis}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(1, 118, 211, 0.06)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white border border-[#DDDBDA] p-2.5 rounded shadow-md text-xs">
                            <p className="font-bold text-[#181818] mb-1">{data.label}</p>
                            <p className="text-[#0176D3] font-semibold">
                              Revenue: {formatCurrency(data.revenue)}
                            </p>
                            <p className="text-[#706E6B] mt-0.5">
                              Orders: <span className="font-semibold text-[#181818]">{data.orderCount}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#0176D3"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right: Orders by Status (40% -> 5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-bold text-[#181818]">Orders by Status</h2>
              <p className="text-xs text-[#706E6B]">Current distribution of all active orders</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              Total: {sales?.totalOrders ?? 0}
            </span>
          </div>

          <div className="h-[210px] w-full flex items-center justify-center">
            {isSalesLoading || !isMounted ? (
              <div className="h-full w-full bg-slate-50 animate-pulse rounded flex items-center justify-center text-xs text-slate-400">
                Loading order status...
              </div>
            ) : donutData.length === 0 ? (
              <div className="text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                <Boxes size={28} className="text-slate-300" />
                <span>No orders recorded yet</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white border border-[#DDDBDA] p-2 rounded shadow-md text-xs">
                            <div className="flex items-center gap-1.5 mb-1 font-bold text-[#181818]">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: data.color }}
                              />
                              {data.name}
                            </div>
                            <p className="text-[#706E6B]">
                              Count:{' '}
                              <span className="font-semibold text-[#181818]">{data.value}</span>
                            </p>
                            <p className="text-[#706E6B]">
                              Value:{' '}
                              <span className="font-semibold text-[#0176D3]">
                                {formatCurrency(data.totalValue)}
                              </span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Status Breakdown Legend Grid */}
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            {donutData.map((item) => (
              <div key={item.name} className="flex items-center justify-between pr-2">
                <span className="flex items-center gap-1.5 truncate text-[#444444]">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-bold text-[#181818] ml-1">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── BOTTOM ROW: Recent Orders (Left) & Low Stock Alerts (Right) ─ */}
      <div className="grid grid-cols-1 gap-6">
        {/* Left Panel: Recent Orders (last 5) */}
        <div className="bg-white rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] flex flex-col justify-between overflow-hidden">
          <div className="p-4 border-b border-[#DDDBDA] flex items-center justify-between bg-slate-50/60">
            <div>
              <h2 className="text-sm font-bold text-[#181818]">Recent Orders</h2>
              <p className="text-[11px] text-[#706E6B]">Latest orders submitted across all channels</p>
            </div>
            <Link
              href="/orders"
              className="text-xs font-semibold text-[#0176D3] hover:underline flex items-center gap-1"
            >
              View All Orders
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#DDDBDA] bg-slate-50/40 text-[#706E6B] font-semibold">
                  <th className="py-2.5 px-3">Order#</th>
                  <th className="py-2.5 px-3">Dealer</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDDBDA]/60">
                {isOrdersLoading ? (
                  <TableSkeleton cols={5} rows={5} />
                ) : recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No recent orders found.
                    </td>
                  </tr>
                ) : (
                  recentOrders.slice(0, 5).map((order) => {
                    const st = STATUS_CONFIG[order.status] || {
                      label: order.status,
                      bg: 'bg-slate-100',
                      text: 'text-slate-800',
                      border: 'border-slate-200',
                    };
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-semibold text-[#0176D3] whitespace-nowrap">
                          <Link href={`/orders/${order.id}`} className="hover:underline">
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 text-[#181818] font-medium max-w-[240px] truncate">
                          {order.dealer?.businessName || order.dealer?.name}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#181818]">
                          {formatCurrency(order.grandTotal)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.bg} ${st.text} ${st.border}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#706E6B] whitespace-nowrap">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel: Low Stock Alerts */}
        <div className="bg-white rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] flex flex-col justify-between overflow-hidden">
          <div className="p-4 border-b border-[#DDDBDA] flex items-center justify-between bg-slate-50/60">
            <div>
              <h2 className="text-sm font-bold text-[#181818]">Low Stock Alerts</h2>
              <p className="text-[11px] text-[#706E6B]">SKUs with physical stock at or below reorder threshold</p>
            </div>
            <Link
              href="/inventory"
              className="text-xs font-semibold text-[#0176D3] hover:underline flex items-center gap-1"
            >
              View Inventory
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#DDDBDA] bg-slate-50/40 text-[#706E6B] font-semibold">
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Variant</th>
                  <th className="py-2.5 px-3">Warehouse</th>
                  <th className="py-2.5 px-3 text-center">Available</th>
                  <th className="py-2.5 px-3 text-center">Reorder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDDBDA]/60">
                {isAlertsLoading ? (
                  <TableSkeleton cols={5} rows={4} />
                ) : stockAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 size={28} className="text-[#2E844A]" />
                        <span className="text-xs font-semibold text-[#2E844A]">
                          All stock levels are healthy
                        </span>
                        <span className="text-[11px] text-[#706E6B]">
                          No variants are currently below their reorder points.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  stockAlerts.slice(0, 5).map((alert) => {
                    const isBelowReorder = alert.availableQuantity <= alert.reorderPoint;
                    return (
                      <tr
                        key={alert.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-medium text-[#181818] max-w-[240px] truncate">
                          {alert.productVariant?.product?.name}
                        </td>
                        <td className="py-2.5 px-3 text-[#706E6B] max-w-[200px] truncate">
                          {alert.productVariant?.name}
                        </td>
                        <td className="py-2.5 px-3 text-[#181818] whitespace-nowrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-medium text-slate-700">
                            {alert.warehouse?.code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-bold ${
                              isBelowReorder ? 'text-[#BA0517]' : 'text-[#2E844A]'
                            }`}
                          >
                            {alert.availableQuantity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-[#706E6B] font-medium">
                          {alert.reorderPoint}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeletons ──────────────────────────────────────────

function KPICardSkeleton() {
  return (
    <div className="bg-white p-5 rounded border border-[#DDDBDA] shadow-[0_2px_4px_rgba(0,0,0,0.08)] animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="h-7 w-28 bg-slate-200 rounded" />
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-100" />
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="h-3 w-24 bg-slate-200 rounded" />
      </div>
    </div>
  );
}

function TableSkeleton({ cols, rows }: { cols: number; rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="animate-pulse">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="py-3 px-3">
              <div className="h-3 bg-slate-100 rounded w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
