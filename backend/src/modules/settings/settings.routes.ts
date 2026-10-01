import { Router } from 'express';
import { settingsController } from './settings.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { validate } from '../../middleware/validate.middleware.js';
import { settingKeyParamSchema } from './settings.dto.js';
import { asyncHandler } from '../../common/async-handler.js';

const router = Router();

// ─── Dealer / Public Access ──────────────────────────────────────────
// Read-only company & payment details for dealers and invoice reference
router.get('/public', authenticate, asyncHandler(settingsController.getPublic));

// ─── Admin-Only Management ───────────────────────────────────────────
router.use(authenticate, requireRole([UserRole.ADMIN]));

// Initialize default settings if not already seeded
router.post('/initialize', asyncHandler(settingsController.initialize));

// Get all settings as grouped object
router.get('/', asyncHandler(settingsController.getAll));

// Get specific setting
router.get(
  '/:key',
  validate(settingKeyParamSchema),
  asyncHandler(settingsController.getByKey)
);

// Update specific setting (upsert)
router.put(
  '/:key',
  validate(settingKeyParamSchema),
  asyncHandler(settingsController.updateSetting)
);

export const settingRoutes = router;
