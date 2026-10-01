import { Router } from 'express';
import { notificationsController } from './notifications.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// All notification endpoints require authenticated user
router.use(authenticate);

// Get current user's notifications (?unread=true optional)
router.get('/', asyncHandler(notificationsController.getNotifications));

// Mark all as read (support both PATCH /mark-all-read and POST /read-all)
router.patch('/mark-all-read', asyncHandler(notificationsController.markAllAsRead));
router.post('/read-all', asyncHandler(notificationsController.markAllAsRead));

// Mark single notification as read
router.patch('/:id/read', asyncHandler(notificationsController.markAsRead));

export const notificationRoutes = router;
