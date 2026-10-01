import { Router } from 'express';
import { brandsController } from './brands.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import {
  brandIdParamSchema,
  createBrandSchema,
  updateBrandSchema,
} from './brands.dto.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// Public
router.get('/', asyncHandler(brandsController.findAll));
router.get('/:id', validate(brandIdParamSchema), asyncHandler(brandsController.findById));

// Admin only
router.post(
  '/',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(createBrandSchema),
  asyncHandler(brandsController.create)
);

router.put(
  '/:id',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(updateBrandSchema),
  asyncHandler(brandsController.update)
);

router.delete(
  '/:id',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(brandIdParamSchema),
  asyncHandler(brandsController.delete)
);

export const brandRoutes = router;
