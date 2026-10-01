import { z } from 'zod';
import { UserStatus } from '@prisma/client';

export const dealerQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    search: z.string().optional(),
    status: z.enum(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'INACTIVE']).default('ALL'),
  }),
});

export const dealerIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer ID format'),
  }),
});

export const approveDealerSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer ID format'),
  }),
  body: z.object({
    creditLimit: z.coerce.number().min(0, 'Credit limit must be non-negative'),
    creditDays: z.coerce.number().int().min(1, 'Credit period must be at least 1 day').default(30),
    assignedWarehouseId: z.string().uuid('Invalid warehouse ID').optional().nullable(),
  }),
});

export const rejectDealerSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer ID format'),
  }),
  body: z.object({
    rejectionReason: z.string().min(3, 'Rejection reason must be at least 3 characters'),
  }),
});

export const updateDealerAdminSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer ID format'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional().nullable(),
    businessName: z.string().min(2).optional(),
    businessAddress: z.string().min(5).optional(),
    gstNumber: z.string().optional().nullable(),
    creditLimit: z.coerce.number().min(0).optional(),
    creditDays: z.coerce.number().int().min(1).optional(),
    remainingCreditLimit: z.coerce.number().min(0).optional(),
    assignedWarehouseId: z.string().uuid().optional().nullable(),
  }),
});

export const updateDealerSelfSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional().nullable(),
    businessAddress: z.string().min(5).optional(),
  }),
});

export const setDiscountSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer ID format'),
  }),
  body: z.object({
    categoryId: z.string().uuid('Invalid category ID format'),
    discountPercentage: z.coerce.number().min(0).max(100, 'Discount percentage must be between 0 and 100'),
  }),
});

export const bulkDiscountsSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer ID format'),
  }),
  body: z.object({
    discounts: z
      .array(
        z.object({
          categoryId: z.string().uuid('Invalid category ID format'),
          discountPercentage: z.coerce.number().min(0).max(100),
        })
      )
      .min(1, 'Discounts array cannot be empty'),
  }),
});

export const categoryDiscountParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid dealer ID format'),
    categoryId: z.string().uuid('Invalid category ID format'),
  }),
});

export type DealerQueryParams = z.infer<typeof dealerQuerySchema>['query'];
export type ApproveDealerInput = z.infer<typeof approveDealerSchema>['body'];
export type RejectDealerInput = z.infer<typeof rejectDealerSchema>['body'];
export type UpdateDealerAdminInput = z.infer<typeof updateDealerAdminSchema>['body'];
export type UpdateDealerSelfInput = z.infer<typeof updateDealerSelfSchema>['body'];
export type SetDiscountInput = z.infer<typeof setDiscountSchema>['body'];
export type BulkDiscountsInput = z.infer<typeof bulkDiscountsSchema>['body'];
