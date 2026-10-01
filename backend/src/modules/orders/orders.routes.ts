import { Router } from 'express';
import { ordersController } from './orders.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import {
  addPaymentSchema,
  checkoutSchema,
  orderIdParamSchema,
  orderQuerySchema,
} from './orders.dto.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// Checkout (Dealer only)
router.post(
  '/checkout',
  authenticate,
  requireRole([UserRole.DEALER]),
  validate(checkoutSchema),
  asyncHandler(ordersController.checkout)
);

// Order listing & details (Admin sees all, Dealer sees own)
router.get(
  '/',
  authenticate,
  validate(orderQuerySchema),
  asyncHandler(ordersController.findAll)
);

router.get(
  '/:id',
  authenticate,
  validate(orderIdParamSchema),
  asyncHandler(ordersController.findById)
);

// Admin order status management
router.post(
  '/:id/confirm',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(orderIdParamSchema),
  asyncHandler(ordersController.confirmOrder)
);

router.post(
  '/:id/cancel',
  authenticate,
  requireRole([UserRole.ADMIN, UserRole.DEALER]),
  validate(orderIdParamSchema),
  asyncHandler(ordersController.cancelOrder)
);

// Payment recording (Dealers submit payment proof/reference, Admin can record too)
router.post(
  '/:id/payments',
  authenticate,
  validate(addPaymentSchema),
  asyncHandler(ordersController.addPayment)
);

export const orderRoutes = router;
