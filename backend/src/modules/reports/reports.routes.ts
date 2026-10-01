import { Router } from 'express';
import { reportsController } from './reports.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import {
  categoryReportQuerySchema,
  dealerReportQuerySchema,
  salesReportQuerySchema,
} from './reports.dto.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// All reporting endpoints are strictly Admin only
router.use(authenticate, requireRole([UserRole.ADMIN]));

// Dashboard KPIs Summary
router.get('/summary', asyncHandler(reportsController.getSummary));

// Sales Report & Export
router.get(
  '/sales',
  validate(salesReportQuerySchema),
  asyncHandler(reportsController.getSalesReport)
);
router.get(
  '/sales/export',
  validate(salesReportQuerySchema),
  asyncHandler(reportsController.exportSalesCsv)
);

// Categories Report
router.get(
  '/categories',
  validate(categoryReportQuerySchema),
  asyncHandler(reportsController.getCategoryReport)
);

// Dealers Report & Export
router.get(
  '/dealers',
  validate(dealerReportQuerySchema),
  asyncHandler(reportsController.getDealerReport)
);
router.get(
  '/dealers/export',
  validate(dealerReportQuerySchema),
  asyncHandler(reportsController.exportDealersCsv)
);

// Inventory Snapshot & Export
router.get('/inventory', asyncHandler(reportsController.getInventoryReport));
router.get('/inventory/export', asyncHandler(reportsController.exportInventoryCsv));

export const reportRoutes = router;
