import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters'),
    description: z.string().optional().nullable(),
    image: z.string().url('Image must be a valid URL').optional().nullable(),
    parentId: z.string().uuid('Invalid parent category ID').optional().nullable(),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters').optional(),
    description: z.string().optional().nullable(),
    image: z.string().url('Image must be a valid URL').optional().nullable(),
    parentId: z.string().uuid('Invalid parent category ID').optional().nullable(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid category ID format'),
  }),
});

export const getCategoryByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid category ID format'),
  }),
});

export const categoryQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    search: z.string().optional(),
    level: z.coerce.number().int().min(1).max(3).optional(),
    parentId: z.string().uuid().optional(),
    isActive: z.enum(['true', 'false']).optional(),
  }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];
export type CategoryQueryParams = z.infer<typeof categoryQuerySchema>['query'];
