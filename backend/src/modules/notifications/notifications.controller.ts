import { Response } from 'express';
import { notificationsService } from './notifications.service.js';
import { AuthenticatedRequest } from '../../common/types.js';

export class NotificationsController {
  getNotifications = async (req: AuthenticatedRequest, res: Response) => {
    const unreadOnly = req.query.unread === 'true';
    const result = await notificationsService.getNotifications(req.user!.id, unreadOnly);

    return res.status(200).json({
      success: true,
      data: result.notifications,
      unreadCount: result.unreadCount,
    });
  };

  markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
    await notificationsService.markAllAsRead(req.user!.id);

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  };

  markAsRead = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await notificationsService.markAsRead(req.user!.id, id);

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  };
}

export const notificationsController = new NotificationsController();
