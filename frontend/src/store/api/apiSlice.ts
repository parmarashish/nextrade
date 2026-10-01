import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { RootState } from '../index';
import { logout, updateToken } from '../slices/authSlice';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // Attempt refresh token call via cookie
    const refreshResult = await baseQuery(
      {
        url: '/auth/refresh',
        method: 'POST',
      },
      api,
      extraOptions
    );

    if (refreshResult.data) {
      const data = refreshResult.data as { data: { accessToken: string } };
      api.dispatch(updateToken(data.data.accessToken));
      // Retry original request with newly acquired token
      result = await baseQuery(args, api, extraOptions);
    } else {
      api.dispatch(logout());
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth',
    'Category',
    'Brand',
    'Product',
    'Inventory',
    'Warehouse',
    'Dealer',
    'Cart',
    'Order',
    'Dispatch',
    'Invoice',
    'Report',
    'Setting',
    'Notification',
  ],
  endpoints: () => ({}),
});
