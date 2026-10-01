import { apiSlice } from '@/store/api/apiSlice';

export type DispatchStatusType = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface DispatchCounts {
  all: number;
  pending: number;
  inTransit: number;
  delivered: number;
  cancelled: number;
}

export interface DispatchListItem {
  id: string;
  dispatchNumber: string;
  orderId: string;
  warehouseId: string;
  status: DispatchStatusType;
  trackingNumber: string | null;
  courierName: string | null;
  notes: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    dealer: {
      id: string;
      name: string;
      businessName: string | null;
    };
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
  _count?: {
    items: number;
  };
}

export interface DispatchesResponse {
  success: boolean;
  data: DispatchListItem[];
  counts: DispatchCounts;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DispatchQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  orderId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface DispatchItemDetail {
  id: string;
  dispatchId: string;
  orderItemId: string;
  productVariantId: string;
  quantity: number;
  createdAt: string;
  productVariant: {
    id: string;
    name: string;
    sku: string;
    packingDetails: string | null;
    product: {
      id: string;
      name: string;
      images: string[];
    };
  };
}

export interface DispatchDetail {
  id: string;
  dispatchNumber: string;
  orderId: string;
  warehouseId: string;
  status: DispatchStatusType;
  trackingNumber: string | null;
  courierName: string | null;
  notes: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    shippingAddress: any;
    dealerId: string;
    grandTotal?: number;
    dealer: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      businessName: string | null;
    };
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
    address: string;
    city: string;
  };
  items: DispatchItemDetail[];
}

export interface CreateDispatchPayload {
  orderId: string;
  items: Array<{
    orderItemId: string;
    productVariantId: string;
    quantity: number;
  }>;
  trackingNumber?: string | null;
  courierName?: string | null;
  notes?: string | null;
}

export interface UpdateTrackingPayload {
  id: string;
  trackingNumber: string;
  courierName: string;
  notes?: string | null;
}

export const dispatchApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDispatches: builder.query<DispatchesResponse, DispatchQueryParams | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.status && params.status !== 'ALL') queryParams.set('status', params.status);
        if (params?.orderId) queryParams.set('orderId', params.orderId);
        if (params?.search) queryParams.set('search', params.search);
        if (params?.dateFrom) queryParams.set('dateFrom', params.dateFrom);
        if (params?.dateTo) queryParams.set('dateTo', params.dateTo);

        return `/dispatches?${queryParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'Dispatch' as const, id })),
              { type: 'Dispatch', id: 'LIST' },
            ]
          : [{ type: 'Dispatch', id: 'LIST' }],
    }),

    getDispatchById: builder.query<{ success: boolean; data: DispatchDetail }, string>({
      query: (id) => `/dispatches/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Dispatch', id }],
    }),

    createDispatch: builder.mutation<
      {
        success: boolean;
        message: string;
        data: {
          dispatch: DispatchDetail;
          orderStatus: string;
          isFullyDispatched: boolean;
          invoiceNumber?: string | null;
        };
      },
      CreateDispatchPayload
    >({
      query: (body) => ({
        url: '/dispatches',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Dispatch', id: 'LIST' },
        'Order',
        'Inventory',
        'Warehouse',
        'Report',
      ],
    }),

    updateTracking: builder.mutation<
      { success: boolean; message: string; data: DispatchDetail },
      UpdateTrackingPayload
    >({
      query: ({ id, ...body }) => ({
        url: `/dispatches/${id}/tracking`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Dispatch', id },
        { type: 'Dispatch', id: 'LIST' },
        'Order',
      ],
    }),

    markDelivered: builder.mutation<
      {
        success: boolean;
        message: string;
        data: { dispatch: DispatchDetail; orderDelivered: boolean };
      },
      string
    >({
      query: (id) => ({
        url: `/dispatches/${id}/deliver`,
        method: 'PATCH',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Dispatch', id },
        { type: 'Dispatch', id: 'LIST' },
        'Order',
        'Report',
      ],
    }),
  }),
});

export const {
  useGetDispatchesQuery,
  useGetDispatchByIdQuery,
  useCreateDispatchMutation,
  useUpdateTrackingMutation,
  useMarkDeliveredMutation,
} = dispatchApi;
