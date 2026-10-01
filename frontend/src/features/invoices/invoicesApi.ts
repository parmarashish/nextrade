import { apiSlice } from '@/store/api/apiSlice';

export type PaymentStatusType =
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'REJECTED';

export interface InvoiceListItem {
  id: string;
  orderNumber: string;
  invoiceNumber: string;
  status: string;
  paymentStatus: PaymentStatusType;
  subtotal: number;
  discount: number;
  totalGST: number;
  grandTotal: number;
  creditDaysForOrder: number | null;
  createdAt: string;
  dealer: {
    id: string;
    name: string;
    businessName: string | null;
    gstNumber: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
    city: string;
  };
  _count?: {
    items: number;
  };
}

export interface InvoicesListResponse {
  success: boolean;
  data: InvoiceListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface InvoiceQueryParams {
  page?: number;
  limit?: number;
  warehouseId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface InvoiceItemDetail {
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
    packingDetails?: string | null;
    product: {
      id: string;
      name: string;
    };
  };
}

export interface InvoicePayment {
  id: string;
  amount: number;
  paymentMethod: string | null;
  referenceId: string | null;
  screenshotUrl?: string | null;
  paymentSource: string;
  status: PaymentStatusType;
  verifiedAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface InvoiceDetail {
  id: string;
  orderNumber: string;
  invoiceNumber: string;
  dealerId: string;
  warehouseId: string;
  status: string;
  subtotal: number;
  discount: number;
  totalGST: number;
  grandTotal: number;
  paymentStatus: PaymentStatusType;
  shippingAddress: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  notes?: string | null;
  creditDaysForOrder: number | null;
  createdAt: string;
  updatedAt: string;
  dealer: {
    id: string;
    name: string;
    email: string;
    phone: string;
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
    pincode: string;
    phone: string;
    contactPerson: string;
  };
  items: InvoiceItemDetail[];
  payments?: InvoicePayment[];
}

export interface PublicSettingsResponse {
  success: boolean;
  data: {
    company: {
      name: string;
      address: string;
      city: string;
      state: string;
      pincode: string;
      phone: string;
      email: string;
      website: string;
      gstNumber: string;
      logo?: string;
    };
    bankDetails: {
      bankName: string;
      accountNumber: string;
      ifscCode: string;
      accountHolderName: string;
      upiId: string;
    };
  };
}

export const invoicesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getInvoices: builder.query<InvoicesListResponse, InvoiceQueryParams | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.warehouseId && params.warehouseId !== 'ALL') queryParams.set('warehouseId', params.warehouseId);
        if (params?.search) queryParams.set('search', params.search);
        if (params?.dateFrom) queryParams.set('dateFrom', params.dateFrom);
        if (params?.dateTo) queryParams.set('dateTo', params.dateTo);

        return `/invoices?${queryParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'Invoice' as const, id })),
              { type: 'Invoice', id: 'LIST' },
            ]
          : [{ type: 'Invoice', id: 'LIST' }],
    }),

    getInvoiceById: builder.query<{ success: boolean; data: InvoiceDetail }, string>({
      query: (id) => `/invoices/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Invoice', id }],
    }),

    downloadInvoicePdf: builder.query<Blob, string>({
      query: (id) => ({
        url: `/invoices/${id}/pdf`,
        responseHandler: (response) => response.blob(),
      }),
    }),

    regenerateInvoice: builder.mutation<{ success: boolean; message: string; data: any }, string>({
      query: (orderId) => ({
        url: `/invoices/generate/${orderId}`,
        method: 'POST',
      }),
      invalidatesTags: ['Invoice', 'Order'],
    }),

    getPublicSettings: builder.query<PublicSettingsResponse, void>({
      query: () => '/settings/public',
      providesTags: ['Setting'],
    }),
  }),
});

export const {
  useGetInvoicesQuery,
  useGetInvoiceByIdQuery,
  useLazyDownloadInvoicePdfQuery,
  useRegenerateInvoiceMutation,
  useGetPublicSettingsQuery,
} = invoicesApi;
