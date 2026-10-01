import { Router } from 'express';
import { warehousesController } from './warehouses.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  warehouseIdParamSchema,
} from './warehouses.dto.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// Authenticated users (Admin sees all, Dealer sees assigned)
router.get('/', authenticate, asyncHandler(warehousesController.findAll));
router.get('/:id', authenticate, validate(warehouseIdParamSchema), asyncHandler(warehousesController.findById));

// Admin only routes
router.get(
  '/:id/summary',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(warehouseIdParamSchema),
  asyncHandler(warehousesController.getSummary)
);

router.post(
  '/',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(createWarehouseSchema),
  asyncHandler(warehousesController.create)
);

router.put(
  '/:id',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(updateWarehouseSchema),
  asyncHandler(warehousesController.update)
);

router.delete(
  '/:id',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(warehouseIdParamSchema),
  asyncHandler(warehousesController.delete)
);

export const warehouseRoutes = router;
