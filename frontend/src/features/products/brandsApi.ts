import { apiSlice } from '@/store/api/apiSlice';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
  };
}

export const brandsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBrands: builder.query<{ success: boolean; data: Brand[] }, void>({
      query: () => '/brands',
      providesTags: ['Brand'],
    }),
    getAllBrands: builder.query<{ success: boolean; data: Brand[] }, void>({
      query: () => '/brands?includeInactive=true',
      providesTags: ['Brand'],
    }),
    createBrand: builder.mutation<{ success: boolean; data: Brand }, BrandInput>({
      query: (body) => ({ url: '/brands', method: 'POST', body }),
      invalidatesTags: ['Brand', 'Product'],
    }),
    updateBrand: builder.mutation<{ success: boolean; data: Brand }, { id: string } & Partial<BrandInput>>({
      query: ({ id, ...body }) => ({ url: `/brands/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Brand', 'Product'],
    }),
    deleteBrand: builder.mutation<{ success: boolean; message?: string }, string>({
      query: (id) => ({ url: `/brands/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Brand'],
    }),
  }),
});

export interface BrandInput {
  name: string;
  logo?: string | null;
  description?: string | null;
  isActive: boolean;
}

export const {
  useGetBrandsQuery,
  useGetAllBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
} = brandsApi;
