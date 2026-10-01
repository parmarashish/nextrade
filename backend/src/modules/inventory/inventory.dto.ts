import { z } from 'zod';
import { StockMovementType } from '@prisma/client';

export const stockAdjustSchema = z.object({
  body: z.object({
    warehouseId: z.string().uuid('Invalid warehouse ID'),
    productVariantId: z.string().uuid('Invalid product variant ID'),
    quantity: z.coerce.number().int('Quantity must be an integer'),
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT'] as const),
    notes: z.string().optional().nullable(),
  }),
});

export const stockTransferSchema = z.object({
  body: z
    .object({
      fromWarehouseId: z.string().uuid('Invalid source warehouse ID'),
      toWarehouseId: z.string().uuid('Invalid destination warehouse ID'),
      productVariantId: z.string().uuid('Invalid product variant ID'),
      quantity: z.coerce.number().int().positive('Transfer quantity must be positive'),
      notes: z.string().optional().nullable(),
    })
    .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
      message: 'Source and destination warehouses must be different',
      path: ['toWarehouseId'],
    }),
});

export const inventoryQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    warehouseId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    search: z.string().optional(),
    stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).optional(),
  }),
});

export const movementQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    warehouseId: z.string().uuid().optional(),
    productVariantId: z.string().uuid().optional(),
    type: z.nativeEnum(StockMovementType).optional(),
    dateFrom: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    dateTo: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  }),
});

export type StockAdjustInput = z.infer<typeof stockAdjustSchema>['body'];
export type StockTransferInput = z.infer<typeof stockTransferSchema>['body'];
export type InventoryQueryParams = z.infer<typeof inventoryQuerySchema>['query'];
export type MovementQueryParams = z.infer<typeof movementQuerySchema>['query'];
