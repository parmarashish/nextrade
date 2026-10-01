import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../common/app-error.js';
import { AuthenticatedRequest, AuthUserPayload } from '../common/types.js';
import { prisma } from '../common/prisma.js';
import { UserStatus } from '@prisma/client';

interface DecodedToken extends AuthUserPayload {
  sub: string;
  sessionId: string;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Authentication token is missing');
    }

    const token = authHeader.split(' ')[1];
    let decoded: DecodedToken;

    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as DecodedToken;
    } catch {
      throw AppError.unauthorized('Invalid or expired authentication token');
    }

    // Verify session still exists and has not expired or been revoked
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      select: { id: true, expiresAt: true, user: { select: { status: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      throw AppError.unauthorized('Session has expired or was revoked. Please log in again.');
    }

    if (session.user.status === UserStatus.INACTIVE || session.user.status === UserStatus.REJECTED) {
      throw AppError.forbidden('Account access revoked');
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      status: decoded.status,
      assignedWarehouseId: decoded.assignedWarehouseId,
      impersonatedBy: decoded.impersonatedBy,
    };
    req.sessionId = decoded.sessionId;

    return next();
  } catch (err) {
    return next(err);
  }
};

export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    let decoded: DecodedToken;

    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as DecodedToken;
    } catch {
      return next();
    }

    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      select: { id: true, expiresAt: true, user: { select: { status: true } } },
    });

    if (session && session.expiresAt >= new Date()) {
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        status: decoded.status,
        assignedWarehouseId: decoded.assignedWarehouseId,
        impersonatedBy: decoded.impersonatedBy,
      };
      req.sessionId = decoded.sessionId;
    }

    return next();
  } catch {
    return next();
  }
};
