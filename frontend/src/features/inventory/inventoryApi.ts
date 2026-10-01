import { apiSlice } from '@/store/api/apiSlice';

export interface StockAlert {
  id: string;
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
  productVariant: {
    id: string;
    name: string;
    sku: string;
    price: number;
    product: {
      id: string;
      name: string;
    };
  };
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderPoint: number;
  severity: 'CRITICAL' | 'WARNING';
}

export interface InventoryItem {
  id: string;
  warehouseId: string;
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
  productVariantId: string;
  productVariant: {
    id: string;
    name: string;
    sku: string;
    price: number;
    costPrice?: number;
    gstPercentage: number;
    packingDetails: string | null;
    product: {
      id: string;
      name: string;
      category?: { id: string; name: string };
    };
  };
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderPoint: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  updatedAt: string;
}

export interface InventoryQueryParams {
  page?: number;
  limit?: number;
  warehouseId?: string;
  categoryId?: string;
  search?: string;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface StockMovementItem {
  id: string;
  warehouseId: string;
  productVariantId: string;
  quantity: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RESERVED' | 'RELEASED';
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  performedById: string;
  createdAt: string;
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
  productVariant: {
    id: string;
    name: string;
    sku: string;
    product: {
      id: string;
      name: string;
    };
  };
  performedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface MovementsQueryParams {
  page?: number;
  limit?: number;
  warehouseId?: string;
  productVariantId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdjustStockInput {
  warehouseId: string;
  productVariantId: string;
  quantity: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  notes?: string | null;
}

export interface TransferStockInput {
  fromWarehouseId: string;
  toWarehouseId: string;
  productVariantId: string;
  quantity: number;
  notes?: string | null;
}

export const inventoryApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getInventory: builder.query<
      {
        success: boolean;
        data: InventoryItem[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      },
      InventoryQueryParams | void
    >({
      query: (params) => ({
        url: '/inventory',
        params: params || {},
      }),
      providesTags: ['Inventory'],
    }),

    getInventoryAlerts: builder.query<{ success: boolean; data: StockAlert[] }, { warehouseId?: string } | void>({
      query: (params) => ({
        url: '/inventory/alerts',
        params: params || {},
      }),
      providesTags: ['Inventory'],
    }),

    getStockMovements: builder.query<
      {
        success: boolean;
        data: StockMovementItem[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      },
      MovementsQueryParams | void
    >({
      query: (params) => ({
        url: '/inventory/movements',
        params: params || {},
      }),
      providesTags: ['Inventory'],
    }),

    adjustStock: builder.mutation<{ success: boolean; message: string; data: any }, AdjustStockInput>({
      query: (body) => ({
        url: '/inventory/adjust',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Inventory', 'Warehouse', 'Product', 'Report'],
    }),

    transferStock: builder.mutation<{ success: boolean; message: string; data: any }, TransferStockInput>({
      query: (body) => ({
        url: '/inventory/transfer',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Inventory', 'Warehouse', 'Product', 'Report'],
    }),
  }),
});

export const {
  useGetInventoryQuery,
  useGetInventoryAlertsQuery,
  useGetStockMovementsQuery,
  useAdjustStockMutation,
  useTransferStockMutation,
} = inventoryApi;
