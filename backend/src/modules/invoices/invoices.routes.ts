import { Router } from 'express';
import { invoicesController } from './invoices.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import {
  invoiceIdParamSchema,
  invoiceQuerySchema,
  orderIdParamSchema,
} from './invoices.dto.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// List invoices (Admin sees all, Dealer sees own)
router.get(
  '/',
  authenticate,
  validate(invoiceQuerySchema),
  asyncHandler(invoicesController.findAll)
);

// Admin manual invoice generation/regeneration for an order
router.post(
  '/generate/:orderId',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(orderIdParamSchema),
  asyncHandler(invoicesController.generateInvoice)
);

// Get single invoice details
router.get(
  '/:id',
  authenticate,
  validate(invoiceIdParamSchema),
  asyncHandler(invoicesController.findById)
);

// Download invoice PDF (Admin: any, Dealer: own)
router.get(
  '/:id/pdf',
  authenticate,
  validate(invoiceIdParamSchema),
  asyncHandler(invoicesController.downloadPdf)
);

export const invoiceRoutes = router;
