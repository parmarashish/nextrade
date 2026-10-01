import { Router } from 'express';
import { categoriesController } from './categories.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import {
  categoryQuerySchema,
  createCategorySchema,
  getCategoryByIdSchema,
  updateCategorySchema,
} from './categories.dto.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// Public routes
router.get('/tree', asyncHandler(categoriesController.getTree));
router.get(
  '/flat',
  validate(categoryQuerySchema),
  asyncHandler(categoriesController.getFlat)
);
router.get(
  '/:id',
  validate(getCategoryByIdSchema),
  asyncHandler(categoriesController.getById)
);

// Protected Admin routes
router.post(
  '/',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(createCategorySchema),
  asyncHandler(categoriesController.create)
);

router.put(
  '/:id',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(updateCategorySchema),
  asyncHandler(categoriesController.update)
);

router.delete(
  '/:id',
  authenticate,
  requireRole([UserRole.ADMIN]),
  asyncHandler(categoriesController.delete)
);

export const categoryRoutes = router;
