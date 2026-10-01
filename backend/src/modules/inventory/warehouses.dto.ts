import { z } from 'zod';

export const createWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Warehouse name must be at least 2 characters'),
    code: z
      .string()
      .regex(/^WH-[A-Z]{3}-\d{2}$/, 'Warehouse code must follow WH-{CITY}-{SEQ} format (e.g. WH-MUM-01)')
      .optional(),
    address: z.string().min(5, 'Address is required'),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    pincode: z.string().regex(/^\d{6}$/, 'PIN code must be exactly 6 digits'),
    contactPerson: z.string().optional().nullable(),
    contactPhone: z.string().optional().nullable(),
    isPrimary: z.boolean().default(false),
    isActive: z.boolean().default(true),
    invoiceSettings: z
      .object({
        prefix: z.string().default('INV-'),
        padding: z.number().int().min(3).max(8).default(5),
        reset: z.enum(['NEVER', 'YEARLY', 'MONTHLY']).default('YEARLY'),
      })
      .optional(),
  }),
});

export const updateWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    code: z.string().regex(/^WH-[A-Z]{3}-\d{2}$/).optional(),
    address: z.string().min(5).optional(),
    city: z.string().min(2).optional(),
    state: z.string().min(2).optional(),
    pincode: z.string().regex(/^\d{6}$/).optional(),
    contactPerson: z.string().optional().nullable(),
    contactPhone: z.string().optional().nullable(),
    isPrimary: z.boolean().optional(),
    isActive: z.boolean().optional(),
    invoiceSettings: z.record(z.any()).optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid warehouse ID format'),
  }),
});

export const warehouseIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid warehouse ID format'),
  }),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>['body'];
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>['body'];
