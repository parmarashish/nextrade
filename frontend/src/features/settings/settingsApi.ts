import { apiSlice } from '@/store/api/apiSlice';

export type SettingKey =
  | 'COMPANY_INFO'
  | 'INVOICE_SETTINGS'
  | 'INVENTORY_SETTINGS'
  | 'NOTIFICATION_SETTINGS';

export interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website?: string;
  gstNumber?: string;
  logo?: string;
}

export interface InvoiceSettings {
  defaultCreditDays: number;
  dueDateBuffer: number;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  upiId?: string;
}

export interface InventorySettings {
  defaultReorderPoint: number;
  defaultLowStockThreshold: number;
  allowNegativeStock: boolean;
}

export interface NotificationSettings {
  lowStockEmailEnabled: boolean;
  orderConfirmationEnabled: boolean;
  paymentReminderEnabled: boolean;
}

export interface AllSettings {
  COMPANY_INFO: CompanyInfo;
  INVOICE_SETTINGS: InvoiceSettings;
  INVENTORY_SETTINGS: InventorySettings;
  NOTIFICATION_SETTINGS: NotificationSettings;
}

export const settingsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query<{ success: boolean; data: AllSettings }, void>({
      query: () => '/settings',
      providesTags: ['Setting'],
    }),

    updateSettings: builder.mutation<
      { success: boolean; message: string; data: any },
      { key: SettingKey; data: Record<string, any> }
    >({
      query: ({ key, data }) => ({
        url: `/settings/${key}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Setting'],
    }),

    initializeSettings: builder.mutation<{ success: boolean; message: string }, void>({
      query: () => ({
        url: '/settings/initialize',
        method: 'POST',
      }),
      invalidatesTags: ['Setting'],
    }),
  }),
});

export const {
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useInitializeSettingsMutation,
} = settingsApi;
