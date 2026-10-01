import { z } from 'zod';

const variantInputSchema = z.object({
  name: z.string().min(1, 'Variant name is required (e.g. 50mm / Chrome)'),
  price: z.coerce.number().positive('Price must be greater than 0'),
  mrp: z.coerce.number().positive().optional().nullable(),
  costPrice: z.coerce.number().positive().optional().nullable(),
  gstPercentage: z.coerce.number().min(0).max(100).default(18),
  minimumQuantity: z.coerce.number().int().min(1).default(1),
  packingDetails: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Product name must be at least 2 characters'),
    description: z.string().optional().nullable(),
    categoryId: z.string().uuid('Invalid category ID'),
    brandId: z.string().uuid('Invalid brand ID').optional().nullable(),
    images: z.array(z.string().url()).default([]),
    isActive: z.boolean().default(true),
    variants: z.array(variantInputSchema).min(1, 'Product must have at least one variant').optional(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Product name must be at least 2 characters').optional(),
    description: z.string().optional().nullable(),
    categoryId: z.string().uuid('Invalid category ID').optional(),
    brandId: z.string().uuid('Invalid brand ID').optional().nullable(),
    images: z.array(z.string().url()).optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid product ID format'),
  }),
});

export const createVariantSchema = z.object({
  body: variantInputSchema,
  params: z.object({
    id: z.string().uuid('Invalid product ID format'),
  }),
});

export const updateVariantSchema = z.object({
  body: variantInputSchema.partial(),
  params: z.object({
    id: z.string().uuid('Invalid product ID format'),
    variantId: z.string().uuid('Invalid variant ID format'),
  }),
});

export const productIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid product ID format'),
  }),
});

export const variantParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid product ID format'),
    variantId: z.string().uuid('Invalid variant ID format'),
  }),
});

export const productQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    search: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    brandId: z.string().uuid().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional(),
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type CreateVariantInput = z.infer<typeof createVariantSchema>['body'];
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>['body'];
export type ProductQueryParams = z.infer<typeof productQuerySchema>['query'];
