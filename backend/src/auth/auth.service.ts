import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../common/prisma.js';
import { AppError } from '../common/app-error.js';
import { env } from '../config/env.js';
import { AuthUserPayload, RequestContext } from '../common/types.js';
import {
  generateSecureToken,
  hashToken,
} from './session.helper.js';
import {
  ChangePasswordInput,
  DealerRegisterInput,
  LoginInput,
} from './auth.dto.js';

export class AuthService {
  // ─── Generate Tokens ─────────────────────────────────────────

  private generateAccessToken(user: AuthUserPayload, sessionId: string): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        assignedWarehouseId: user.assignedWarehouseId,
        sessionId,
        impersonatedBy: user.impersonatedBy,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any, algorithm: 'HS256' }
    );
  }

  // ─── Create Session ──────────────────────────────────────────

  private async createSession(
    user: AuthUserPayload,
    ctx: RequestContext
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const rawRefreshToken = generateSecureToken();
    const refreshTokenHash = hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        deviceName: ctx.deviceName,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        impersonatedBy: user.impersonatedBy,
        expiresAt,
      },
    });

    const accessToken = this.generateAccessToken(user, session.id);

    return {
      accessToken,
      refreshToken: `${session.id}.${rawRefreshToken}`,
    };
  }

  // ─── Login ───────────────────────────────────────────────────

  async login(input: LoginInput, ctx: RequestContext) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    // Role-based Status Check
    if (user.role === UserRole.DEALER) {
      if (user.status === UserStatus.PENDING) {
        throw AppError.forbidden(
          'Your dealer account is pending admin approval. You will receive an email once approved.'
        );
      }
      if (user.status === UserStatus.REJECTED) {
        throw AppError.forbidden(
          `Your dealer account application was rejected: ${user.rejectionReason || 'Please contact support.'}`
        );
      }
      if (user.status !== UserStatus.APPROVED) {
        throw AppError.forbidden('Your account is currently inactive.');
      }
    } else if (user.status === UserStatus.INACTIVE) {
      throw AppError.forbidden('Your account is currently inactive.');
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const userPayload: AuthUserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      assignedWarehouseId: user.assignedWarehouseId,
    };

    const tokens = await this.createSession(userPayload, ctx);

    // Audit log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { email: user.email, role: user.role },
      },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        businessName: user.businessName,
        creditLimit: user.creditLimit,
        creditDays: user.creditDays,
        remainingCreditLimit: user.remainingCreditLimit,
      },
    };
  }

  // ─── Register Dealer (Workflow: status = PENDING) ───────────

  async registerDealer(input: DealerRegisterInput, ctx: RequestContext) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw AppError.conflict('An account with this email address already exists');
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const dealer = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        password: hashedPassword,
        name: input.name,
        phone: input.phone,
        role: UserRole.DEALER,
        status: UserStatus.PENDING, // Awaits admin approval
        businessName: input.businessName,
        businessAddress: input.businessAddress,
        gstNumber: input.gstNumber?.toUpperCase() || null,
        creditLimit: 0,
        creditDays: 30,
        remainingCreditLimit: 0,
      },
    });

    // Record audit log
    await prisma.activityLog.create({
      data: {
        userId: dealer.id,
        action: 'REGISTER',
        entityType: 'DEALER',
        entityId: dealer.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: {
          email: dealer.email,
          businessName: dealer.businessName,
          status: 'PENDING',
        },
      },
    });

    return {
      message: 'Dealer registration submitted successfully. Your account is pending admin approval.',
      dealerId: dealer.id,
      status: dealer.status,
    };
  }

  // ─── Refresh Token (Revocable Session Rotation) ──────────────

  async refreshToken(cookieRefreshToken: string, ctx: RequestContext) {
    if (!cookieRefreshToken || !cookieRefreshToken.includes('.')) {
      throw AppError.unauthorized('Invalid refresh token format');
    }

    const [sessionId, rawToken] = cookieRefreshToken.split('.');
    const hashed = hashToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.refreshTokenHash !== hashed) {
      // Possible token reuse attack — revoke session
      if (session) {
        await prisma.session.delete({ where: { id: sessionId } });
      }
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: sessionId } });
      throw AppError.unauthorized('Refresh token has expired');
    }

    const { user } = session;

    if (user.role === UserRole.DEALER && user.status !== UserStatus.APPROVED) {
      throw AppError.forbidden('Dealer account is not approved or is inactive');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw AppError.forbidden('Account is inactive');
    }

    // Rotate refresh token
    const newRawRefreshToken = generateSecureToken();
    const newHash = hashToken(newRawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: newHash,
        lastActiveAt: new Date(),
        expiresAt,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });

    const userPayload: AuthUserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      assignedWarehouseId: user.assignedWarehouseId,
      impersonatedBy: session.impersonatedBy,
    };

    const newAccessToken = this.generateAccessToken(userPayload, sessionId);

    return {
      accessToken: newAccessToken,
      refreshToken: `${sessionId}.${newRawRefreshToken}`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        impersonatedBy: session.impersonatedBy,
      },
    };
  }

  // ─── Admin Impersonation ─────────────────────────────────────

  async impersonateDealer(adminUser: AuthUserPayload, dealerId: string, ctx: RequestContext) {
    if (adminUser.role !== UserRole.ADMIN) {
      throw AppError.forbidden('Only administrators can impersonate dealers');
    }

    const dealer = await prisma.user.findFirst({
      where: { id: dealerId, role: UserRole.DEALER },
    });

    if (!dealer) {
      throw AppError.notFound('Dealer not found');
    }

    if (dealer.status !== UserStatus.APPROVED) {
      throw AppError.badRequest(`Cannot impersonate dealer in '${dealer.status}' status`);
    }

    const dealerPayload: AuthUserPayload = {
      id: dealer.id,
      email: dealer.email,
      name: dealer.name,
      role: dealer.role,
      status: dealer.status,
      assignedWarehouseId: dealer.assignedWarehouseId,
      impersonatedBy: adminUser.id,
    };

    const tokens = await this.createSession(dealerPayload, ctx);

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId: adminUser.id,
        action: 'IMPERSONATE',
        entityType: 'DEALER',
        entityId: dealer.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: {
          adminEmail: adminUser.email,
          dealerEmail: dealer.email,
        },
      },
    });

    return {
      ...tokens,
      user: {
        id: dealer.id,
        email: dealer.email,
        name: dealer.name,
        role: dealer.role,
        status: dealer.status,
        businessName: dealer.businessName,
        impersonatedBy: adminUser.id,
        impersonatedByName: adminUser.name,
      },
    };
  }

  async stopImpersonation(currentUser: AuthUserPayload, currentSessionId: string | undefined, ctx: RequestContext) {
    if (!currentUser.impersonatedBy) {
      throw AppError.badRequest('Currently not in an impersonation session');
    }

    const admin = await prisma.user.findUnique({
      where: { id: currentUser.impersonatedBy },
    });

    if (!admin || admin.role !== UserRole.ADMIN) {
      throw AppError.notFound('Original admin account not found');
    }

    const adminPayload: AuthUserPayload = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      status: admin.status,
    };

    const tokens = await this.createSession(adminPayload, ctx);

    // End the dealer impersonation session
    if (currentSessionId) {
      await prisma.session.deleteMany({ where: { id: currentSessionId } });
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        status: admin.status,
      },
    };
  }

  // ─── Logout ──────────────────────────────────────────────────

  async logout(sessionId: string) {
    if (sessionId) {
      await prisma.session.deleteMany({ where: { id: sessionId } });
    }
  }

  // ─── Logout All Devices ──────────────────────────────────────

  async logoutAll(userId: string) {
    await prisma.session.deleteMany({ where: { userId } });
  }

  // ─── Change Password ─────────────────────────────────────────

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const isMatch = await bcrypt.compare(input.currentPassword, user.password);
    if (!isMatch) {
      throw AppError.badRequest('Current password is incorrect');
    }

    const newHashed = await bcrypt.hash(input.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: newHashed },
    });

    // Revoke all existing sessions to enforce re-login
    await prisma.session.deleteMany({ where: { userId } });

    return { message: 'Password updated successfully. Please log in again.' };
  }
}

export const authService = new AuthService();
