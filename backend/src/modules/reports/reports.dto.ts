import { z } from 'zod';
import { UserStatus } from '@prisma/client';

const dateStringSchema = z
  .string()
  .datetime({ offset: true })
  .optional()
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());

export const salesReportQuerySchema = z.object({
  query: z.object({
    dateFrom: dateStringSchema,
    dateTo: dateStringSchema,
    warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  }),
});

export const categoryReportQuerySchema = z.object({
  query: z.object({
    dateFrom: dateStringSchema,
    dateTo: dateStringSchema,
  }),
});

export const dealerReportQuerySchema = z.object({
  query: z.object({
    dateFrom: dateStringSchema,
    dateTo: dateStringSchema,
    status: z.enum(['ALL', ...Object.values(UserStatus)]).default('ALL'),
  }),
});

export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>['query'];
export type CategoryReportQuery = z.infer<typeof categoryReportQuerySchema>['query'];
export type DealerReportQuery = z.infer<typeof dealerReportQuerySchema>['query'];
