import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  changePasswordSchema,
  dealerRegisterSchema,
  impersonateSchema,
  loginSchema,
} from './auth.dto.js';
import { authRateLimiter, refreshRateLimiter } from '../middleware/rate-limiter.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.guard.js';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../common/async-handler.js';

const router = Router();

// Public routes (rate limited)
router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  asyncHandler(authController.login)
);

router.post(
  '/register',
  authRateLimiter,
  validate(dealerRegisterSchema),
  asyncHandler(authController.register)
);

router.post(
  '/refresh',
  refreshRateLimiter,
  asyncHandler(authController.refresh)
);

// Authenticated routes
router.get('/me', authenticate, asyncHandler(authController.me));
router.post('/logout', authenticate, asyncHandler(authController.logout));
router.post('/logout-all', authenticate, asyncHandler(authController.logoutAll));
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword)
);

// Admin-only route: Impersonate dealer
router.post(
  '/impersonate',
  authenticate,
  requireRole([UserRole.ADMIN]),
  validate(impersonateSchema),
  asyncHandler(authController.impersonate)
);
router.post(
  '/impersonate/:dealerId',
  authenticate,
  requireRole([UserRole.ADMIN]),
  asyncHandler(authController.impersonate)
);
router.post(
  '/stop-impersonation',
  authenticate,
  asyncHandler(authController.stopImpersonation)
);

export const authRoutes = router;
