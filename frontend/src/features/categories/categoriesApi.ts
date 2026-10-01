import { apiSlice } from '@/store/api/apiSlice';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  level: number;
  levelBadge: 'Root' | 'Subcategory' | 'Child';
  breadcrumbPath: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  children: CategoryNode[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryFlatItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  level: number;
  levelBadge: 'Root' | 'Subcategory' | 'Child';
  breadcrumbPath: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string | null;
  image?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryRequest {
  id: string;
  name?: string;
  description?: string | null;
  image?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export const categoriesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCategoryTree: builder.query<{ success: boolean; data: CategoryNode[] }, void>({
      query: () => '/categories/tree',
      providesTags: ['Category'],
    }),
    getCategoryFlat: builder.query<
      { success: boolean; data: CategoryFlatItem[]; meta: { total: number; page: number; limit: number; totalPages: number } },
      { page?: number; limit?: number; search?: string; level?: number } | void
    >({
      query: (params) => ({
        url: '/categories/flat',
        params: params || {},
      }),
      providesTags: ['Category'],
    }),
    getCategoryById: builder.query<
      { success: boolean; data: CategoryFlatItem & { breadcrumbTrail: { id: string; name: string; slug: string }[] } },
      string
    >({
      query: (id) => `/categories/${id}`,
      providesTags: (_res, _err, id) => [{ type: 'Category', id }, 'Category'],
    }),
    createCategory: builder.mutation<{ success: boolean; message: string; data: CategoryFlatItem }, CreateCategoryRequest>({
      query: (body) => ({
        url: '/categories',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Category'],
    }),
    updateCategory: builder.mutation<{ success: boolean; message: string; data: CategoryFlatItem }, UpdateCategoryRequest>({
      query: ({ id, ...body }) => ({
        url: `/categories/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Category'],
    }),
    deleteCategory: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Category'],
    }),
  }),
});

export const {
  useGetCategoryTreeQuery,
  useGetCategoryFlatQuery,
  useGetCategoryByIdQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} = categoriesApi;
