import { apiSlice } from '../apiSlice';

export interface Dealer {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
  businessName: string | null;
  businessAddress: string | null;
  gstNumber: string | null;
  creditLimit: number;
  creditDays: number;
  remainingCreditLimit: number;
  rejectionReason: string | null;
  paymentReminderDaysBefore?: number | null;
  assignedWarehouseId: string | null;
  assignedWarehouse?: { id: string; name: string; code: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
  _count?: { orders: number; categoryDiscounts: number };
}

export interface DealerQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface DealerStatusCounts {
  all: number;
  pending: number;
  approved: number;
  rejected: number;
  inactive: number;
}

export interface DealersResponse {
  data: Dealer[];
  counts: DealerStatusCounts;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CategoryDiscountItem {
  id: string;
  dealerId: string;
  categoryId: string;
  discountPercentage: number;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
    level: number;
  };
}

export interface DealerOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  createdAt: string;
}

export interface DealerActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: any;
  createdAt: string;
}

export interface DealerStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  outstandingAmount: number;
  creditLimit: number;
  remainingCreditLimit: number;
  usedCredit: number;
  creditUtilizationPercent: number;
  lastOrderDate: string | null;
}

export interface DealerDetail extends Dealer {
  avatar?: string | null;
  role: string;
  categoryDiscounts: CategoryDiscountItem[];
  stats: DealerStats;
  recentOrders: DealerOrderSummary[];
  activityLogs: DealerActivityLog[];
  updatedAt: string;
}

export interface ApproveDealerPayload {
  id: string;
  creditLimit: number;
  creditDays: number;
  assignedWarehouseId?: string | null;
}

export interface RejectDealerPayload {
  id: string;
  rejectionReason: string;
}

export interface SetDiscountPayload {
  id: string;
  categoryId: string;
  discountPercentage: number;
}

export interface RegisterDealerPayload {
  name: string;
  email: string;
  password: string;
  phone: string;
  businessName: string;
  businessAddress: string;
  gstNumber?: string;
}

export const dealersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDealers: builder.query<DealersResponse, DealerQueryParams | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.search) queryParams.set('search', params.search);
        if (params?.status && params.status !== 'ALL') queryParams.set('status', params.status);

        return `/dealers?${queryParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'Dealer' as const, id })),
              { type: 'Dealer', id: 'LIST' },
            ]
          : [{ type: 'Dealer', id: 'LIST' }],
    }),

    getDealerById: builder.query<{ success: boolean; data: DealerDetail }, string>({
      query: (id) => `/dealers/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Dealer', id }],
    }),

    getDealerProfile: builder.query<{ success: boolean; data: any }, void>({
      query: () => '/dealers/me',
      providesTags: ['Dealer'],
    }),

    approveDealer: builder.mutation<{ success: boolean; message: string; data: Dealer }, ApproveDealerPayload>({
      query: ({ id, ...body }) => ({
        url: `/dealers/${id}/approve`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Dealer', id },
        { type: 'Dealer', id: 'LIST' },
      ],
    }),

    rejectDealer: builder.mutation<{ success: boolean; message: string; data: Dealer }, RejectDealerPayload>({
      query: ({ id, ...body }) => ({
        url: `/dealers/${id}/reject`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Dealer', id },
        { type: 'Dealer', id: 'LIST' },
      ],
    }),

    deactivateDealer: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/dealers/${id}/deactivate`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Dealer', id },
        { type: 'Dealer', id: 'LIST' },
      ],
    }),

    reactivateDealer: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/dealers/${id}/reactivate`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Dealer', id },
        { type: 'Dealer', id: 'LIST' },
      ],
    }),

    getDealerDiscounts: builder.query<{ success: boolean; data: CategoryDiscountItem[] }, string>({
      query: (id) => `/dealers/${id}/discounts`,
      providesTags: (_result, _error, id) => [{ type: 'Dealer', id: `${id}-DISCOUNTS` }],
    }),

    setDealerDiscount: builder.mutation<{ success: boolean; message: string }, SetDiscountPayload>({
      query: ({ id, ...body }) => ({
        url: `/dealers/${id}/discounts`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Dealer', id },
        { type: 'Dealer', id: `${id}-DISCOUNTS` },
      ],
    }),

    deleteDealerDiscount: builder.mutation<{ success: boolean; message: string }, { id: string; categoryId: string }>({
      query: ({ id, categoryId }) => ({
        url: `/dealers/${id}/discounts/${categoryId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Dealer', id },
        { type: 'Dealer', id: `${id}-DISCOUNTS` },
      ],
    }),

    createDealer: builder.mutation<{ success: boolean; message: string; data: any }, RegisterDealerPayload>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Dealer', id: 'LIST' }],
    }),

    impersonateDealer: builder.mutation<
      {
        success: boolean;
        message: string;
        data: {
          accessToken: string;
          user: {
            id: string;
            email: string;
            name: string;
            role: 'DEALER';
            status: 'APPROVED';
            businessName?: string | null;
            assignedWarehouseId?: string | null;
            impersonatedBy?: string;
          };
        };
      },
      string
    >({
      query: (dealerId) => ({
        url: `/auth/impersonate/${dealerId}`,
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useGetDealersQuery,
  useGetDealerByIdQuery,
  useGetDealerProfileQuery,
  useApproveDealerMutation,
  useRejectDealerMutation,
  useDeactivateDealerMutation,
  useReactivateDealerMutation,
  useGetDealerDiscountsQuery,
  useSetDealerDiscountMutation,
  useDeleteDealerDiscountMutation,
  useCreateDealerMutation,
  useImpersonateDealerMutation,
} = dealersApi;
