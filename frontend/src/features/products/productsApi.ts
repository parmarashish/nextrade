import { apiSlice } from '@/store/api/apiSlice';

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  images: string[];
  isActive: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
    level: number;
  };
  categoryBreadcrumb?: string;
  brand: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  } | null;
  variantCount: number;
  priceRange: {
    min: number;
    max: number;
  };
  dealerDiscountPercent?: number;
  effectivePriceRange?: {
    min: number;
    max: number;
  };
  totalStock: number;
  hasLowStock: boolean;
  createdAt: string;
}

export interface WarehouseStockSummary {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  available: number;
}

export interface ProductVariantDetail {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  mrp: number | null;
  costPrice?: number;
  gstPercentage: number;
  minimumQuantity: number;
  packingDetails: string | null;
  isActive: boolean;
  dealerDiscountPercent: number;
  effectivePrice: number;
  inventory: {
    totalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    warehouses: WarehouseStockSummary[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  images: string[];
  isActive: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
    level: number;
    parentId: string | null;
  };
  brand: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  } | null;
  dealerDiscountPercent: number;
  variants: ProductVariantDetail[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: string;
}

export interface CreateVariantInput {
  name: string;
  price: number;
  mrp?: number | null;
  costPrice?: number | null;
  gstPercentage?: number;
  minimumQuantity?: number;
  packingDetails?: string | null;
  isActive?: boolean;
}

export interface CreateProductInput {
  name: string;
  description?: string | null;
  categoryId: string;
  brandId?: string | null;
  images?: string[];
  isActive?: boolean;
  variants?: CreateVariantInput[];
}

export interface UpdateProductInput {
  id: string;
  name?: string;
  description?: string | null;
  categoryId?: string;
  brandId?: string | null;
  images?: string[];
  isActive?: boolean;
}

export interface UpdateVariantInput {
  productId: string;
  variantId: string;
  name?: string;
  price?: number;
  mrp?: number | null;
  costPrice?: number | null;
  gstPercentage?: number;
  minimumQuantity?: number;
  packingDetails?: string | null;
  isActive?: boolean;
}

export const productsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<
      {
        success: boolean;
        data: ProductListItem[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      },
      ProductsQueryParams | void
    >({
      query: (params) => ({
        url: '/products',
        params: params || {},
      }),
      providesTags: ['Product'],
    }),

    getProductById: builder.query<{ success: boolean; data: ProductDetail }, string>({
      query: (id) => `/products/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Product', id }, 'Product'],
    }),

    createProduct: builder.mutation<{ success: boolean; message: string; data: ProductDetail }, CreateProductInput>({
      query: (body) => ({
        url: '/products',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Product', 'Inventory', 'Report'],
    }),

    updateProduct: builder.mutation<{ success: boolean; message: string; data: ProductDetail }, UpdateProductInput>({
      query: ({ id, ...body }) => ({
        url: `/products/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_res, _err, { id }) => [{ type: 'Product', id }, 'Product'],
    }),

    deleteProduct: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/products/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Product', 'Inventory', 'Report'],
    }),

    addVariant: builder.mutation<
      { success: boolean; message: string; data: ProductVariantDetail },
      { productId: string; body: CreateVariantInput }
    >({
      query: ({ productId, body }) => ({
        url: `/products/${productId}/variants`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_res, _err, { productId }) => [{ type: 'Product', id: productId }, 'Product'],
    }),

    updateVariant: builder.mutation<
      { success: boolean; message: string; data: ProductVariantDetail },
      UpdateVariantInput
    >({
      query: ({ productId, variantId, ...body }) => ({
        url: `/products/${productId}/variants/${variantId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_res, _err, { productId }) => [{ type: 'Product', id: productId }, 'Product'],
    }),

    deleteVariant: builder.mutation<
      { success: boolean; message: string },
      { productId: string; variantId: string }
    >({
      query: ({ productId, variantId }) => ({
        url: `/products/${productId}/variants/${variantId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, { productId }) => [{ type: 'Product', id: productId }, 'Product'],
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductByIdQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useAddVariantMutation,
  useUpdateVariantMutation,
  useDeleteVariantMutation,
} = productsApi;
