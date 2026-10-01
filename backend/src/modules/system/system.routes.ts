import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.guard.js';
import { seedDatabase } from './reseed.service.js';
import { AuthenticatedRequest } from '../../common/types.js';

export const systemRoutes = Router();

/**
 * POST /api/system/reseed
 * Resets the database and reseeds with pristine portfolio demo data.
 * Authorized if:
 * 1. Valid CRON_SECRET matches 'x-cron-secret' header (for GitHub Actions / Render cron)
 * 2. OR caller has an active authenticated ADMIN session
 */
systemRoutes.post(
  '/reseed',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cronSecretHeader = req.headers['x-cron-secret'];
      const isCronSecretValid =
        Boolean(env.CRON_SECRET) &&
        Boolean(cronSecretHeader) &&
        cronSecretHeader === env.CRON_SECRET;

      if (isCronSecretValid) {
        console.log('🔄 Triggering automated database reseed via authorized cron secret...');
        const stats = await seedDatabase();
        return res.json({
          success: true,
          message: 'Database successfully reseeded to pristine demo state via cron.',
          stats,
        });
      }

      // If cron secret was not provided or didn't match, verify admin session
      return (authenticate as any)(
        req as AuthenticatedRequest,
        res,
        (authErr?: any) => {
          if (authErr) return next(authErr);

          return requireRole(['ADMIN'])(
            req as AuthenticatedRequest,
            res,
            async (roleErr?: any) => {
              if (roleErr) return next(roleErr);

              try {
                console.log('🔄 Triggering admin manual database reseed...');
                const stats = await seedDatabase();
                return res.json({
                  success: true,
                  message: 'Database successfully reseeded to pristine demo state by admin.',
                  stats,
                });
              } catch (err) {
                return next(err);
              }
            }
          );
        }
      );
    } catch (error) {
      return next(error);
    }
  }
);
