import { apiSlice } from '@/store/api/apiSlice';

export type OrderStatusType =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PARTIALLY_DISPATCHED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatusType =
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'REJECTED';

export interface OrderCounts {
  all: number;
  pending: number;
  confirmed: number;
  processing: number;
  partiallyDispatched: number;
  dispatched: number;
  delivered: number;
  cancelled: number;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  dealerId: string;
  warehouseId: string;
  status: OrderStatusType;
  subtotal: number;
  discount: number;
  totalGST: number;
  grandTotal: number;
  paymentStatus: PaymentStatusType;
  shippingAddress: any;
  notes?: string | null;
  invoiceNumber?: string | null;
  createdAt: string;
  dealer: {
    id: string;
    name: string;
    businessName: string | null;
    email: string;
  };
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  _count?: {
    items: number;
    dispatches: number;
  };
}

export type RecentOrder = OrderListItem;

export interface OrdersListResponse {
  success: boolean;
  data: OrderListItem[];
  counts: OrderCounts;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface OrdersQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  paymentStatus?: string;
  search?: string;
  warehouseId?: string;
  dealerId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface OrderItemDetail {
  id: string;
  orderId: string;
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number;
  dealerDiscount: number; // percentage
  gstPercentage: number;
  gstAmount: number;
  total: number; // taxable amount (excl. GST)
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
  dispatchItems?: Array<{
    quantity: number;
    dispatch: {
      status: string;
    };
  }>;
}

export interface OrderDispatchSummary {
  id: string;
  dispatchNumber: string;
  status: string;
  trackingNumber: string | null;
  courierName: string | null;
  dispatchedAt: string | null;
}

export interface OrderPaymentSummary {
  id: string;
  amount: number;
  paymentMethod: string | null;
  referenceId: string | null;
  status: string;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  dealerId: string;
  warehouseId: string;
  status: OrderStatusType;
  subtotal: number;
  discount: number;
  totalGST: number;
  grandTotal: number;
  paymentStatus: PaymentStatusType;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  notes?: string | null;
  invoiceNumber?: string | null;
  creditDaysForOrder?: number | null;
  createdAt: string;
  updatedAt: string;
  dealer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    businessName: string | null;
    businessAddress: string | null;
    gstNumber: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
    address: string;
    city: string;
    state: string;
  };
  items: OrderItemDetail[];
  dispatches: OrderDispatchSummary[];
  payments: OrderPaymentSummary[];
}

export interface CartItemProduct {
  id: string;
  productVariantId: string;
  variantName: string;
  sku: string;
  productName: string;
  productImages: string[];
  quantity: number;
  originalUnitPrice: number;
  dealerDiscountPercent: number;
  unitPrice: number;
  taxableTotal: number;
  gstPercentage: number;
  gstAmount: number;
  lineTotal: number;
  availableStock: number | null;
  minimumQuantity: number;
  packingDetails: string | null;
}

export interface CartSummary {
  totalItems: number;
  subtotal: number;
  totalDiscount: number;
  totalGST: number;
  grandTotal: number;
}

export interface CartResponse {
  success: boolean;
  data: {
    items: CartItemProduct[];
    summary: CartSummary;
  };
}

export interface CheckoutPayload {
  warehouseId?: string | null;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  notes?: string | null;
}

export interface AddPaymentPayload {
  orderId: string;
  amount: number;
  paymentMethod?: string;
  referenceId?: string;
  notes?: string;
}

export const ordersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<OrdersListResponse, OrdersQueryParams | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.status && params.status !== 'ALL') queryParams.set('status', params.status);
        if (params?.paymentStatus && params.paymentStatus !== 'ALL') queryParams.set('paymentStatus', params.paymentStatus);
        if (params?.search) queryParams.set('search', params.search);
        if (params?.dealerId) queryParams.set('dealerId', params.dealerId);
        if (params?.warehouseId) queryParams.set('warehouseId', params.warehouseId);
        if (params?.dateFrom) queryParams.set('dateFrom', params.dateFrom);
        if (params?.dateTo) queryParams.set('dateTo', params.dateTo);

        return `/orders?${queryParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'Order' as const, id })),
              { type: 'Order', id: 'LIST' },
            ]
          : [{ type: 'Order', id: 'LIST' }],
    }),

    getOrderById: builder.query<{ success: boolean; data: OrderDetail }, string>({
      query: (id) => `/orders/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Order', id }],
    }),

    confirmOrder: builder.mutation<{ success: boolean; message: string; data: OrderDetail }, string>({
      query: (id) => ({
        url: `/orders/${id}/confirm`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
        'Report',
      ],
    }),

    cancelOrder: builder.mutation<{ success: boolean; message: string; data: OrderDetail }, string>({
      query: (id) => ({
        url: `/orders/${id}/cancel`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
        'Inventory',
        'Dealer',
        'Report',
      ],
    }),

    addOrderPayment: builder.mutation<{ success: boolean; message: string; data: any }, AddPaymentPayload>({
      query: ({ orderId, ...body }) => ({
        url: `/orders/${orderId}/payments`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { orderId }) => [
        { type: 'Order', id: orderId },
        { type: 'Order', id: 'LIST' },
        'Dealer',
      ],
    }),

    // Cart Endpoints
    getCart: builder.query<CartResponse, void>({
      query: () => '/cart',
      providesTags: ['Cart'],
    }),

    addToCart: builder.mutation<{ success: boolean; message: string; data: any }, { productVariantId: string; quantity: number }>({
      query: (body) => ({
        url: '/cart',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Cart'],
    }),

    updateCartItem: builder.mutation<{ success: boolean; message: string; data: any }, { itemId: string; quantity: number }>({
      query: ({ itemId, quantity }) => ({
        url: `/cart/${itemId}`,
        method: 'PUT',
        body: { quantity },
      }),
      invalidatesTags: ['Cart'],
    }),

    removeFromCart: builder.mutation<{ success: boolean; message: string }, string>({
      query: (itemId) => ({
        url: `/cart/${itemId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Cart'],
    }),

    clearCart: builder.mutation<{ success: boolean; message: string }, void>({
      query: () => ({
        url: '/cart',
        method: 'DELETE',
      }),
      invalidatesTags: ['Cart'],
    }),

    checkout: builder.mutation<{ success: boolean; message: string; data: OrderDetail }, CheckoutPayload>({
      query: (body) => ({
        url: '/orders/checkout',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Cart', 'Order', 'Inventory', 'Dealer', 'Report'],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useConfirmOrderMutation,
  useCancelOrderMutation,
  useAddOrderPaymentMutation,
  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartItemMutation,
  useRemoveFromCartMutation,
  useClearCartMutation,
  useCheckoutMutation,
} = ordersApi;
