import { z } from 'zod';

export const invoiceQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
    search: z.string().optional(),
    dateFrom: z
      .string()
      .datetime({ offset: true })
      .optional()
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    dateTo: z
      .string()
      .datetime({ offset: true })
      .optional()
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  }),
});

export const invoiceIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID or Number is required'),
  }),
});

export const orderIdParamSchema = z.object({
  params: z.object({
    orderId: z.string().uuid('Invalid order ID'),
  }),
});

export type InvoiceQueryParams = z.infer<typeof invoiceQuerySchema>['query'];
