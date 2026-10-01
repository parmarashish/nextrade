import { Router } from 'express';
import { dealersController } from './dealers.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import {
  approveDealerSchema,
  bulkDiscountsSchema,
  categoryDiscountParamSchema,
  dealerIdParamSchema,
  dealerQuerySchema,
  rejectDealerSchema,
  setDiscountSchema,
  updateDealerAdminSchema,
  updateDealerSelfSchema,
} from './dealers.dto.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// ─── Dealer Self-Service (Must be above /:id) ─────────────────
router.get('/me', authenticate, asyncHandler(dealersController.getMe));
router.put(
  '/me',
  authenticate,
  validate(updateDealerSelfSchema),
  asyncHandler(dealersController.updateMe)
);

// ─── Admin Dealer Management ──────────────────────────────────
router.get(
  '/',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(dealerQuerySchema),
  asyncHandler(dealersController.listDealers)
);

router.get(
  '/:id',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(dealerIdParamSchema),
  asyncHandler(dealersController.getDealerById)
);

router.put(
  '/:id',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(updateDealerAdminSchema),
  asyncHandler(dealersController.updateDealerByAdmin)
);

router.post(
  '/:id/approve',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(approveDealerSchema),
  asyncHandler(dealersController.approveDealer)
);

router.post(
  '/:id/reject',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(rejectDealerSchema),
  asyncHandler(dealersController.rejectDealer)
);

router.post(
  '/:id/deactivate',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(dealerIdParamSchema),
  asyncHandler(dealersController.deactivateDealer)
);

router.post(
  '/:id/reactivate',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(dealerIdParamSchema),
  asyncHandler(dealersController.reactivateDealer)
);

// ─── Category Discount Matrix ─────────────────────────────────
router.get(
  '/:id/discounts',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(dealerIdParamSchema),
  asyncHandler(dealersController.getDiscounts)
);

router.post(
  '/:id/discounts',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(setDiscountSchema),
  asyncHandler(dealersController.setDiscount)
);

router.put(
  '/:id/discounts',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(bulkDiscountsSchema),
  asyncHandler(dealersController.bulkSetDiscounts)
);

router.delete(
  '/:id/discounts/:categoryId',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(categoryDiscountParamSchema),
  asyncHandler(dealersController.removeDiscount)
);

export const dealerRoutes = router;
