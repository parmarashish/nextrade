import { apiSlice } from '../apiSlice';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'ORDER' | 'PAYMENT' | 'INFO' | 'WARNING' | string;
  isRead: boolean;
  data?: any;
  createdAt: string;
}

export interface GetNotificationsResponse {
  success: boolean;
  data: NotificationItem[];
  unreadCount: number;
}

export const notificationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<GetNotificationsResponse, { unreadOnly?: boolean } | void>({
      query: (params) => ({
        url: '/notifications',
        params: params?.unreadOnly ? { unread: true } : undefined,
      }),
      providesTags: ['Notification'],
    }),

    markAllNotificationsRead: builder.mutation<{ success: boolean; message: string }, void>({
      query: () => ({
        url: '/notifications/mark-all-read',
        method: 'PATCH',
      }),
      invalidatesTags: ['Notification'],
    }),

    markNotificationRead: builder.mutation<{ success: boolean; message: string }, string>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} = notificationsApi;
