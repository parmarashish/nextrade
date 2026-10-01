import { Router } from 'express';
import { cartController } from './cart.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import {
  addToCartSchema,
  cartItemIdParamSchema,
  updateCartItemSchema,
} from './orders.dto.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// All cart endpoints require DEALER role
router.use(authenticate, requireRole([UserRole.DEALER]));

router.get('/', asyncHandler(cartController.getCart));
router.post('/', validate(addToCartSchema), asyncHandler(cartController.addToCart));
router.put(
  '/:itemId',
  validate(updateCartItemSchema),
  asyncHandler(cartController.updateCartItem)
);
router.delete(
  '/:itemId',
  validate(cartItemIdParamSchema),
  asyncHandler(cartController.removeFromCart)
);
router.delete('/', asyncHandler(cartController.clearCart));

export const cartRoutes = router;
