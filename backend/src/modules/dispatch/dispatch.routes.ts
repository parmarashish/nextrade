import { Router } from 'express';
import { dispatchController } from './dispatch.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createDispatchSchema,
  dispatchIdParamSchema,
  dispatchQuerySchema,
  updateTrackingSchema,
} from './dispatch.dto.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// Create a new dispatch (Admin only)
router.post(
  '/',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(createDispatchSchema),
  asyncHandler(dispatchController.createDispatch)
);

// List dispatches (Admin sees all, Dealer sees own)
router.get(
  '/',
  authenticate,
  validate(dispatchQuerySchema),
  asyncHandler(dispatchController.findAll)
);

// Get dispatch by ID (Admin sees any, Dealer sees own)
router.get(
  '/:id',
  authenticate,
  validate(dispatchIdParamSchema),
  asyncHandler(dispatchController.findById)
);

// Update tracking details (Admin only)
router.patch(
  '/:id/tracking',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(updateTrackingSchema),
  asyncHandler(dispatchController.updateTracking)
);

// Mark dispatch as delivered (Admin only)
router.patch(
  '/:id/deliver',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(dispatchIdParamSchema),
  asyncHandler(dispatchController.deliverDispatch)
);

export const dispatchRoutes = router;
