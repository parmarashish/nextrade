import { z } from 'zod';
import { OrderStatus, PaymentStatus } from '@prisma/client';

// ─── Cart DTOs ─────────────────────────────────────────────────

export const addToCartSchema = z.object({
  body: z.object({
    productVariantId: z.string().uuid('Invalid product variant ID'),
    quantity: z.coerce.number().int().positive('Quantity must be at least 1').default(1),
  }),
});

export const updateCartItemSchema = z.object({
  params: z.object({
    itemId: z.string().uuid('Invalid cart item ID'),
  }),
  body: z.object({
    quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
  }),
});

export const cartItemIdParamSchema = z.object({
  params: z.object({
    itemId: z.string().uuid('Invalid cart item ID'),
  }),
});

// ─── Order / Checkout DTOs ─────────────────────────────────────

export const checkoutSchema = z.object({
  body: z.object({
    warehouseId: z.string().uuid('Invalid warehouse ID').optional().nullable(),
    shippingAddress: z
      .object({
        name: z.string().min(2),
        phone: z.string().min(10),
        address: z.string().min(5),
        city: z.string().min(2),
        state: z.string().min(2),
        pincode: z.string().regex(/^\d{6}$/),
      })
      .optional()
      .nullable(),
    notes: z.string().max(1000).optional().nullable(),
  }),
});

export const orderQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    status: z.enum(['ALL', ...Object.values(OrderStatus)]).default('ALL'),
    paymentStatus: z.enum(['ALL', ...Object.values(PaymentStatus)]).default('ALL'),
    dealerId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    search: z.string().optional(),
    dateFrom: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    dateTo: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  }),
});

export const addPaymentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid order ID format'),
  }),
  body: z.object({
    amount: z.number().positive().max(10000000),
    paymentMethod: z.enum(['BANK_TRANSFER', 'NEFT', 'UPI', 'CHEQUE', 'CASH']),
    referenceId: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid order ID format'),
  }),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>['body'];
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>['body'];
export type CheckoutInput = z.infer<typeof checkoutSchema>['body'];
export type OrderQueryParams = z.infer<typeof orderQuerySchema>['query'];
