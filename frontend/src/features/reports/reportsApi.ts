import { apiSlice } from '@/store/api/apiSlice';

export interface SummaryReport {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  lowStockAlerts: number;
  revenueChange: number | null;
  ordersChange: number | null;
}

export interface MonthRevenue {
  month: string;
  label: string;
  revenue: number;
  orderCount: number;
}

export type OrderStatusType =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PARTIALLY_DISPATCHED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface StatusBreakdown {
  status: OrderStatusType;
  count: number;
  totalValue: number;
}

export interface TopProductSales {
  productId: string;
  productName: string;
  revenue: number;
  unitsSold: number;
}

export interface SalesReport {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  revenueByMonth: MonthRevenue[];
  revenueByStatus: StatusBreakdown[];
  topProducts?: TopProductSales[];
}

export interface SalesReportParams {
  dateFrom?: string;
  dateTo?: string;
  warehouseId?: string;
}

export interface CategoryReportItem {
  categoryId: string;
  categoryName: string;
  totalOrders: number;
  totalRevenue: number;
  totalUnits: number;
  avgOrderValue: number;
}

export interface DealerReportItem {
  dealerId: string;
  dealerName: string;
  businessName: string;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  lastOrderDate: string | null;
  creditLimit: number;
  remainingCreditLimit: number;
  creditUtilization: number;
}

export interface WarehouseStockSummary {
  warehouseId: string;
  name: string;
  code: string;
  totalVariants: number;
  totalStock: number;
  stockValue: number;
}

export interface TopProductStock {
  productId: string;
  productName: string;
  sku: string;
  totalQuantity: number;
  stockValue: number;
}

export interface InventoryReport {
  totalProducts: number;
  totalVariants: number;
  totalStockValue: number;
  stockByWarehouse: WarehouseStockSummary[];
  lowStockCount: number;
  outOfStockCount: number;
  topProductsByValue: TopProductStock[];
}

export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSummary: builder.query<{ success: boolean; data: SummaryReport }, void>({
      query: () => '/reports/summary',
      providesTags: ['Report'],
    }),

    getSalesReport: builder.query<{ success: boolean; data: SalesReport }, SalesReportParams | void>({
      query: (params) => ({
        url: '/reports/sales',
        params: params || {},
      }),
      providesTags: ['Report'],
    }),

    getCategoriesReport: builder.query<
      { success: boolean; data: CategoryReportItem[] },
      { dateFrom?: string; dateTo?: string } | void
    >({
      query: (params) => ({
        url: '/reports/categories',
        params: params || {},
      }),
      providesTags: ['Report'],
    }),

    getDealersReport: builder.query<
      { success: boolean; data: DealerReportItem[] },
      { dateFrom?: string; dateTo?: string; status?: string } | void
    >({
      query: (params) => ({
        url: '/reports/dealers',
        params: params || {},
      }),
      providesTags: ['Report', 'Dealer'],
    }),

    getInventoryReport: builder.query<{ success: boolean; data: InventoryReport }, void>({
      query: () => '/reports/inventory',
      providesTags: ['Report', 'Inventory'],
    }),

    exportSalesCsv: builder.query<Blob, SalesReportParams | void>({
      query: (params) => ({
        url: '/reports/sales/export',
        params: params || {},
        responseHandler: (response) => response.blob(),
      }),
    }),

    exportDealersCsv: builder.query<Blob, { dateFrom?: string; dateTo?: string; status?: string } | void>({
      query: (params) => ({
        url: '/reports/dealers/export',
        params: params || {},
        responseHandler: (response) => response.blob(),
      }),
    }),

    exportInventoryCsv: builder.query<Blob, void>({
      query: () => ({
        url: '/reports/inventory/export',
        responseHandler: (response) => response.blob(),
      }),
    }),
  }),
});

export const {
  useGetSummaryQuery,
  useGetSalesReportQuery,
  useGetCategoriesReportQuery,
  useGetDealersReportQuery,
  useGetInventoryReportQuery,
  useLazyExportSalesCsvQuery,
  useLazyExportDealersCsvQuery,
  useLazyExportInventoryCsvQuery,
} = reportsApi;
