import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../common/types.js';
import { env } from '../config/env.js';

// Core demo accounts that must never be altered or deactivated
export const PROTECTED_DEMO_EMAILS = [
  'admin@nextrade.com',
  'apex@nextrade.com',
  'buildmart@nextrade.com',
  'profix@nextrade.com',
  'pending@nextrade.com',
  'rejected@nextrade.com',
];

/**
 * Middleware that blocks destructive mutations in Demo Mode
 * to preserve portfolio stability for visitors and recruiters.
 */
export const demoGuard = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!env.DEMO_MODE) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'This action is disabled in Demo Mode to protect portfolio integrity for all visitors.',
    isDemoRestricted: true,
  });
};
