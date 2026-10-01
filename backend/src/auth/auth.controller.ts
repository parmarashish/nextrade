import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { extractRequestContext } from './session.helper.js';
import { AuthenticatedRequest } from '../common/types.js';
import { env } from '../config/env.js';

import { prisma } from '../common/prisma.js';

const REFRESH_COOKIE_NAME = 'nextrade_refresh';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  path: '/',
};

export class AuthController {
  // ─── Login ───────────────────────────────────────────────────
  login = async (req: Request, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await authService.login(req.body, ctx);

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  };

  // ─── Register Dealer ─────────────────────────────────────────
  register = async (req: Request, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await authService.registerDealer(req.body, ctx);

    return res.status(201).json({
      success: true,
      message: result.message,
      data: {
        dealerId: result.dealerId,
        status: result.status,
      },
    });
  };

  // ─── Refresh Token ───────────────────────────────────────────
  refresh = async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
    const ctx = extractRequestContext(req);

    const result = await authService.refreshToken(token, ctx);

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  };

  // ─── Get Current User Profile ────────────────────────────────
  me = async (req: AuthenticatedRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        businessName: true,
        phone: true,
        assignedWarehouseId: true,
        creditLimit: true,
        creditDays: true,
        remainingCreditLimit: true,
      },
    });

    let impersonatedByName: string | null = null;
    if (req.user?.impersonatedBy) {
      const adminUser = await prisma.user.findUnique({
        where: { id: req.user.impersonatedBy },
        select: { name: true },
      });
      impersonatedByName = adminUser?.name || null;
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          ...(user || req.user),
          impersonatedBy: req.user!.impersonatedBy,
          impersonatedByName,
        },
      },
    });
  };

  // ─── Impersonate Dealer (Admin Only) ─────────────────────────
  impersonate = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const dealerId = req.params.dealerId || req.body?.dealerId;
    const result = await authService.impersonateDealer(
      req.user!,
      dealerId,
      ctx
    );

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);

    return res.status(200).json({
      success: true,
      message: `Now impersonating dealer ${result.user.name}`,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  };

  // ─── Stop Impersonation ──────────────────────────────────────
  stopImpersonation = async (req: AuthenticatedRequest, res: Response) => {
    const ctx = extractRequestContext(req);
    const result = await authService.stopImpersonation(req.user!, req.sessionId, ctx);

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);

    return res.status(200).json({
      success: true,
      message: 'Impersonation ended. Returned to admin session.',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  };

  // ─── Logout ──────────────────────────────────────────────────
  logout = async (req: AuthenticatedRequest, res: Response) => {
    if (req.sessionId) {
      await authService.logout(req.sessionId);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  };

  // ─── Logout All Devices ──────────────────────────────────────
  logoutAll = async (req: AuthenticatedRequest, res: Response) => {
    if (req.user) {
      await authService.logoutAll(req.user.id);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });

    return res.status(200).json({
      success: true,
      message: 'All device sessions terminated',
    });
  };

  // ─── Change Password ─────────────────────────────────────────
  changePassword = async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.changePassword(req.user!.id, req.body);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  };
}

export const authController = new AuthController();
