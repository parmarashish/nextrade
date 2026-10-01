import { z } from 'zod';
import { DispatchStatus } from '@prisma/client';

export const dispatchItemInputSchema = z.object({
  orderItemId: z.string().uuid('Invalid order item ID'),
  productVariantId: z.string().uuid('Invalid product variant ID'),
  quantity: z.coerce.number().int().positive('Dispatch quantity must be positive'),
});

export const createDispatchSchema = z.object({
  body: z.object({
    orderId: z.string().uuid('Invalid order ID'),
    items: z.array(dispatchItemInputSchema).min(1, 'Must include at least one item to dispatch'),
    trackingNumber: z.string().optional().nullable(),
    courierName: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
});

export const updateTrackingSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dispatch ID'),
  }),
  body: z.object({
    trackingNumber: z.string().min(2, 'Tracking number is required'),
    courierName: z.string().min(2, 'Courier partner name is required'),
    notes: z.string().optional().nullable(),
  }),
});

export const dispatchIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dispatch ID'),
  }),
});

export const dispatchQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    status: z.enum(['ALL', ...Object.values(DispatchStatus)]).default('ALL'),
    orderId: z.string().uuid().optional(),
    search: z.string().optional(),
    dateFrom: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    dateTo: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  }),
});

export type CreateDispatchInput = z.infer<typeof createDispatchSchema>['body'];
export type UpdateTrackingInput = z.infer<typeof updateTrackingSchema>['body'];
export type DispatchQueryParams = z.infer<typeof dispatchQuerySchema>['query'];
