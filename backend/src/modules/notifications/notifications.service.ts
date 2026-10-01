import { prisma } from '../../common/prisma.js';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: string;
  data?: any;
}

export class NotificationsService {
  async getNotifications(userId: string, unreadOnly?: boolean) {
    // If no notifications exist for this user, seed default mock notifications for realistic UI testing
    const count = await prisma.notification.count({ where: { userId } });
    if (count === 0) {
      await this.seedDefaultUserNotifications(userId);
    }

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return result;
  }

  async markAsRead(userId: string, notificationId: string) {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    return result;
  }

  async createNotification(input: CreateNotificationInput) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type || 'INFO',
        data: input.data || {},
        isRead: false,
      },
    });
  }

  private async seedDefaultUserNotifications(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const now = Date.now();
    const isAdmin = user.role === 'ADMIN';

    const items = isAdmin
      ? [
          {
            title: 'New Order Received',
            message: 'Order ORD-260914-1014 received from Apex Hardware Solutions for ₹1,500.96.',
            type: 'ORDER',
            isRead: false,
            createdAt: new Date(now - 2 * 60 * 60 * 1000), // 2 hours ago
          },
          {
            title: 'Payment Reconciled',
            message: 'NEFT Payment of ₹1,500.96 recorded for Invoice INV-MUM-2627-00001.',
            type: 'PAYMENT',
            isRead: false,
            createdAt: new Date(now - 5 * 60 * 60 * 1000), // 5 hours ago
          },
          {
            title: 'Low Stock Warning',
            message: 'Bosch GSB 500W Impact Drill is below safety buffer (12 units remaining in WH-MUM-01).',
            type: 'WARNING',
            isRead: false,
            createdAt: new Date(now - 14 * 60 * 60 * 1000), // 14 hours ago
          },
          {
            title: 'Warehouse Transfer Completed',
            message: 'Stock movement TRF-260920-0001 from Mumbai to Delhi warehouse completed successfully.',
            type: 'INFO',
            isRead: true,
            createdAt: new Date(now - 26 * 60 * 60 * 1000), // 1 day ago
          },
        ]
      : [
          {
            title: 'Order Confirmed',
            message: 'Your order ORD-260914-1014 has been confirmed and queued for fulfillment.',
            type: 'ORDER',
            isRead: false,
            createdAt: new Date(now - 2 * 60 * 60 * 1000),
          },
          {
            title: 'Payment Receipt Issued',
            message: 'Payment of ₹1,500.96 has been processed and credited to your account.',
            type: 'PAYMENT',
            isRead: false,
            createdAt: new Date(now - 5 * 60 * 60 * 1000),
          },
          {
            title: 'Shipment Dispatched',
            message: 'Dispatch DSP-260918-0001 handed over to Blue Dart Express (AWB: BLUEDART-88291).',
            type: 'INFO',
            isRead: true,
            createdAt: new Date(now - 24 * 60 * 60 * 1000),
          },
        ];

    for (const item of items) {
      await prisma.notification.create({
        data: {
          userId,
          title: item.title,
          message: item.message,
          type: item.type,
          isRead: item.isRead,
          createdAt: item.createdAt,
        },
      });
    }
  }
}

export const notificationsService = new NotificationsService();
