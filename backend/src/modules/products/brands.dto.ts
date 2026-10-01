import { z } from 'zod';

export const createBrandSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Brand name must be at least 2 characters'),
    logo: z.string().url('Logo must be a valid URL').optional().nullable(),
    description: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
  }),
});

export const updateBrandSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Brand name must be at least 2 characters').optional(),
    logo: z.string().url('Logo must be a valid URL').optional().nullable(),
    description: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid brand ID format'),
  }),
});

export const brandIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid brand ID format'),
  }),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>['body'];
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>['body'];
