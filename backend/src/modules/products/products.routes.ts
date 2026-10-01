import { Router } from 'express';
import { productsController } from './products.controller.js';
import { authenticate, optionalAuthenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createProductSchema,
  createVariantSchema,
  productIdParamSchema,
  productQuerySchema,
  updateProductSchema,
  updateVariantSchema,
  variantParamSchema,
} from './products.dto.js';
import { asyncHandler } from '../../common/async-handler.js';
import { demoGuard } from '../../middleware/demo.guard.js';

const router = Router();

// Public / Dealer viewing (personalized with optional auth)
router.get(
  '/',
  optionalAuthenticate,
  validate(productQuerySchema),
  asyncHandler(productsController.findAll)
);

router.get(
  '/:id',
  optionalAuthenticate,
  validate(productIdParamSchema),
  asyncHandler(productsController.findById)
);

// Admin Only Mutations
router.post(
  '/',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(createProductSchema),
  asyncHandler(productsController.create)
);

router.put(
  '/:id',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(updateProductSchema),
  asyncHandler(productsController.update)
);

router.delete(
  '/:id',
  authenticate,
  requireRole([UserRole.ADMIN]),
  demoGuard,
  validate(productIdParamSchema),
  asyncHandler(productsController.delete)
);

// Variant Sub-routes
router.post(
  '/:id/variants',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(createVariantSchema),
  asyncHandler(productsController.addVariant)
);

router.put(
  '/:id/variants/:variantId',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(updateVariantSchema),
  asyncHandler(productsController.updateVariant)
);

router.delete(
  '/:id/variants/:variantId',
  authenticate,
  requireRole([UserRole.ADMIN]),
  demoGuard,
  validate(variantParamSchema),
  asyncHandler(productsController.deleteVariant)
);

export const productRoutes = router;
