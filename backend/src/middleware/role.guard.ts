import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../common/types.js';
import { AppError } from '../common/app-error.js';

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized('User is not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(`Access restricted to: ${allowedRoles.join(', ')}`)
      );
    }

    return next();
  };
};
