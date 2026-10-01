import { apiSlice } from '@/store/api/apiSlice';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPerson: string | null;
  contactPhone: string | null;
  isPrimary: boolean;
  isActive: boolean;
  totalProducts?: number;
  totalStock?: number;
  stockValue?: number;
  lowStockCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseSummaryStockItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  variantSku: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderPoint: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface WarehouseSummary {
  warehouse: Warehouse;
  totalVariantsStocked: number;
  totalPhysicalStock: number;
  totalReservedStock: number;
  totalAvailableStock: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  items: WarehouseSummaryStockItem[];
}

export interface CreateWarehouseInput {
  name: string;
  code?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface UpdateWarehouseInput extends Partial<CreateWarehouseInput> {
  id: string;
}

export const warehousesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getWarehouses: builder.query<{ success: boolean; data: Warehouse[] }, void>({
      query: () => '/warehouses',
      providesTags: ['Warehouse'],
    }),
    getWarehouseSummary: builder.query<{ success: boolean; data: WarehouseSummary }, string>({
      query: (id) => `/warehouses/${id}/summary`,
      providesTags: (_res, _err, id) => [{ type: 'Warehouse', id }],
    }),
    createWarehouse: builder.mutation<{ success: boolean; message: string; data: Warehouse }, CreateWarehouseInput>({
      query: (body) => ({
        url: '/warehouses',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Warehouse', 'Inventory'],
    }),
    updateWarehouse: builder.mutation<{ success: boolean; message: string; data: Warehouse }, UpdateWarehouseInput>({
      query: ({ id, ...body }) => ({
        url: `/warehouses/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Warehouse', 'Inventory'],
    }),
  }),
});

export const {
  useGetWarehousesQuery,
  useGetWarehouseSummaryQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
} = warehousesApi;
