import { apiSlice } from '@/store/api/apiSlice';
import { AuthUser, setCredentials, logout } from '@/store/slices/authSlice';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: AuthUser;
    accessToken: string;
  };
}

export interface GetMeResponse {
  success: boolean;
  data: {
    user: AuthUser;
  };
}

export interface RefreshResponse {
  success: boolean;
  data: {
    accessToken: string;
  };
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            setCredentials({
              user: data.data.user,
              token: data.data.accessToken,
              isImpersonated: false,
              impersonatedBy: null,
            })
          );
        } catch {
          // Error handled in component
        }
      },
    }),

    logout: builder.mutation<{ success: boolean; message: string }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(logout());
        }
      },
    }),

    getMe: builder.query<GetMeResponse, void>({
      query: () => '/auth/me',
      providesTags: ['Auth'],
    }),

    refresh: builder.mutation<RefreshResponse, void>({
      query: () => ({
        url: '/auth/refresh',
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetMeQuery,
  useRefreshMutation,
} = authApi;
