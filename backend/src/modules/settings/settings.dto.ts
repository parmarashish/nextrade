import { z } from 'zod';

export const companyInfoSchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode format (6 digits required)'),
  phone: z.string().min(8, 'Phone number is required'),
  email: z.string().email('Invalid email address'),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid Indian GSTIN format').optional().or(z.literal('')),
  logo: z.string().url('Invalid logo URL').optional().or(z.literal('')),
});

export const invoiceSettingsSchema = z.object({
  defaultCreditDays: z.coerce.number().int().min(0, 'Credit days cannot be negative').default(30),
  dueDateBuffer: z.coerce.number().int().min(0).default(0),
  bankName: z.string().min(2, 'Bank name is required'),
  accountNumber: z.string().min(6, 'Account number is required'),
  ifscCode: z.string().min(4, 'IFSC code is required'),
  accountHolderName: z.string().min(2, 'Account holder name is required'),
  upiId: z.string().optional().or(z.literal('')),
});

export const inventorySettingsSchema = z.object({
  defaultReorderPoint: z.coerce.number().int().min(0).default(10),
  defaultLowStockThreshold: z.coerce.number().int().min(0).default(5),
  allowNegativeStock: z.boolean().default(false),
});

export const notificationSettingsSchema = z.object({
  lowStockEmailEnabled: z.boolean().default(true),
  orderConfirmationEnabled: z.boolean().default(true),
  paymentReminderEnabled: z.boolean().default(true),
});

export const settingKeyEnum = z.enum([
  'COMPANY_INFO',
  'INVOICE_SETTINGS',
  'INVENTORY_SETTINGS',
  'NOTIFICATION_SETTINGS',
]);

export type SettingKey = z.infer<typeof settingKeyEnum>;

export const settingKeyParamSchema = z.object({
  params: z.object({
    key: settingKeyEnum,
  }),
});

export const updateSettingSchema = z.object({
  params: z.object({
    key: settingKeyEnum,
  }),
  body: z.record(z.any()),
});

export type CompanyInfo = z.infer<typeof companyInfoSchema>;
export type InvoiceSettings = z.infer<typeof invoiceSettingsSchema>;
export type InventorySettings = z.infer<typeof inventorySettingsSchema>;
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
