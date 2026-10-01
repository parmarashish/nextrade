import { Router } from 'express';
import { inventoryController } from './inventory.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import {
  inventoryQuerySchema,
  movementQuerySchema,
  stockAdjustSchema,
  stockTransferSchema,
} from './inventory.dto.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// General inventory list (Authenticated users: Admin / Dealer)
router.get(
  '/',
  authenticate,
  validate(inventoryQuerySchema),
  asyncHandler(inventoryController.getInventory)
);

// Admin Only routes
router.get(
  '/alerts',
  authenticate,
  requireRole([UserRole.ADMIN]),
  asyncHandler(inventoryController.getAlerts)
);

router.get(
  '/movements',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(movementQuerySchema),
  asyncHandler(inventoryController.getMovements)
);

router.post(
  '/adjust',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(stockAdjustSchema),
  asyncHandler(inventoryController.adjustStock)
);

router.post(
  '/transfer',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(stockTransferSchema),
  asyncHandler(inventoryController.transferStock)
);

export const inventoryRoutes = router;
