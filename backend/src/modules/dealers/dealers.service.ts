import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/app-error.js';
import {
  ApproveDealerInput,
  BulkDiscountsInput,
  DealerQueryParams,
  RejectDealerInput,
  SetDiscountInput,
  UpdateDealerAdminInput,
  UpdateDealerSelfInput,
} from './dealers.dto.js';
import { AuthUserPayload, RequestContext } from '../../common/types.js';
import { OrderStatus, PaymentStatus, UserRole, UserStatus } from '@prisma/client';
import { env } from '../../config/env.js';

export class DealersService {
  // ─── List Dealers (with Status Counts) ───────────────────────

  async listDealers(query: DealerQueryParams) {
    const { page = 1, limit = 50, search, status } = query;
    const skip = (page - 1) * limit;

    const baseWhere: any = { role: UserRole.DEALER };

    if (search) {
      baseWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { businessName: { contains: search, mode: 'insensitive' } },
        { gstNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Status Tab Counts
    const [allCount, pendingCount, approvedCount, rejectedCount, inactiveCount] = await Promise.all([
      prisma.user.count({ where: { ...baseWhere } }),
      prisma.user.count({ where: { ...baseWhere, status: UserStatus.PENDING } }),
      prisma.user.count({ where: { ...baseWhere, status: UserStatus.APPROVED } }),
      prisma.user.count({ where: { ...baseWhere, status: UserStatus.REJECTED } }),
      prisma.user.count({ where: { ...baseWhere, status: UserStatus.INACTIVE } }),
    ]);

    const where = { ...baseWhere };
    if (status !== 'ALL') {
      where.status = status as UserStatus;
    }

    const [dealers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          status: true,
          businessName: true,
          businessAddress: true,
          gstNumber: true,
          creditLimit: true,
          creditDays: true,
          remainingCreditLimit: true,
          rejectionReason: true,
          assignedWarehouseId: true,
          assignedWarehouse: { select: { id: true, name: true, code: true } },
          lastLoginAt: true,
          createdAt: true,
          _count: { select: { orders: true, categoryDiscounts: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: dealers,
      counts: {
        all: allCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        inactive: inactiveCount,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Get Single Dealer Details & Stats ────────────────────────

  async getDealerById(id: string) {
    const dealer = await prisma.user.findFirst({
      where: { id, role: UserRole.DEALER },
      include: {
        assignedWarehouse: { select: { id: true, name: true, code: true } },
        categoryDiscounts: {
          include: {
            category: { select: { id: true, name: true, slug: true, level: true } },
          },
          orderBy: { category: { name: 'asc' } },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            grandTotal: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!dealer) {
      throw AppError.notFound('Dealer not found');
    }

    const activityLogs = await prisma.activityLog.findMany({
      where: {
        OR: [{ userId: id }, { entityId: id }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Compute Stats
    let totalRevenue = 0;
    let pendingOrders = 0;
    let outstandingAmount = 0;

    dealer.orders.forEach((o) => {
      if (o.status !== OrderStatus.CANCELLED) {
        totalRevenue += Number(o.grandTotal);

        if (
          o.status === OrderStatus.PENDING ||
          o.status === OrderStatus.CONFIRMED ||
          o.status === OrderStatus.PROCESSING
        ) {
          pendingOrders++;
        }

        if (o.paymentStatus !== PaymentStatus.PAID) {
          outstandingAmount += Number(o.grandTotal);
        }
      }
    });

    const creditLimit = dealer.creditLimit ? Number(dealer.creditLimit) : 0;
    const remainingCredit = dealer.remainingCreditLimit ? Number(dealer.remainingCreditLimit) : 0;
    const usedCredit = Math.max(0, creditLimit - remainingCredit);
    const creditUtilization = creditLimit > 0 ? Math.round((usedCredit / creditLimit) * 10000) / 100 : 0;

    return {
      id: dealer.id,
      email: dealer.email,
      name: dealer.name,
      phone: dealer.phone,
      avatar: dealer.avatar,
      role: dealer.role,
      status: dealer.status,
      businessName: dealer.businessName,
      businessAddress: dealer.businessAddress,
      gstNumber: dealer.gstNumber,
      creditLimit: dealer.creditLimit,
      creditDays: dealer.creditDays,
      remainingCreditLimit: dealer.remainingCreditLimit,
      paymentReminderDaysBefore: dealer.paymentReminderDaysBefore,
      rejectionReason: dealer.rejectionReason,
      assignedWarehouse: dealer.assignedWarehouse,
      categoryDiscounts: dealer.categoryDiscounts,
      stats: {
        totalOrders: dealer.orders.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        pendingOrders,
        outstandingAmount: Math.round(outstandingAmount * 100) / 100,
        creditLimit,
        remainingCreditLimit: remainingCredit,
        usedCredit,
        creditUtilizationPercent: creditUtilization,
        lastOrderDate: dealer.orders.length > 0 ? dealer.orders[0].createdAt : null,
      },
      recentOrders: dealer.orders.slice(0, 10),
      activityLogs,
      lastLoginAt: dealer.lastLoginAt,
      createdAt: dealer.createdAt,
      updatedAt: dealer.updatedAt,
    };
  }

  // ─── Approve Dealer ──────────────────────────────────────────

  async approveDealer(id: string, input: ApproveDealerInput, adminId: string, ctx: RequestContext) {
    const dealer = await prisma.user.findFirst({
      where: { id, role: UserRole.DEALER },
    });

    if (!dealer) {
      throw AppError.notFound('Dealer not found');
    }

    if (dealer.status === UserStatus.APPROVED) {
      throw AppError.badRequest('Dealer is already approved');
    }

    if (input.assignedWarehouseId) {
      const wh = await prisma.warehouse.findUnique({ where: { id: input.assignedWarehouseId } });
      if (!wh) throw AppError.notFound('Assigned warehouse not found');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.APPROVED,
        creditLimit: new Decimal(input.creditLimit),
        creditDays: input.creditDays,
        remainingCreditLimit: new Decimal(input.creditLimit),
        assignedWarehouseId: input.assignedWarehouseId || null,
        rejectionReason: null,
      },
      include: {
        assignedWarehouse: { select: { id: true, name: true, code: true } },
      },
    });

    // Activity Log
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'APPROVE',
        entityType: 'DEALER',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: {
          dealerEmail: dealer.email,
          creditLimit: input.creditLimit,
          creditDays: input.creditDays,
          assignedWarehouseId: input.assignedWarehouseId,
        },
      },
    });

    return {
      message: `Dealer "${updated.name}" approved successfully`,
      dealer: updated,
    };
  }

  // ─── Reject Dealer ───────────────────────────────────────────

  async rejectDealer(id: string, input: RejectDealerInput, adminId: string, ctx: RequestContext) {
    const dealer = await prisma.user.findFirst({
      where: { id, role: UserRole.DEALER },
    });

    if (!dealer) {
      throw AppError.notFound('Dealer not found');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.REJECTED,
        rejectionReason: input.rejectionReason.trim(),
      },
    });

    // Revoke any active sessions
    await prisma.session.deleteMany({ where: { userId: id } });

    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'REJECT',
        entityType: 'DEALER',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: {
          dealerEmail: dealer.email,
          reason: input.rejectionReason,
        },
      },
    });

    return {
      message: `Dealer application for "${updated.name}" rejected`,
      dealer: updated,
    };
  }

  // ─── Update Dealer by Admin ──────────────────────────────────

  async updateDealerByAdmin(
    id: string,
    input: UpdateDealerAdminInput,
    adminId: string,
    ctx: RequestContext
  ) {
    const dealer = await prisma.user.findFirst({
      where: { id, role: UserRole.DEALER },
    });

    if (!dealer) {
      throw AppError.notFound('Dealer not found');
    }

    if (input.assignedWarehouseId) {
      const wh = await prisma.warehouse.findUnique({ where: { id: input.assignedWarehouseId } });
      if (!wh) throw AppError.notFound('Assigned warehouse not found');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.businessName ? { businessName: input.businessName.trim() } : {}),
        ...(input.businessAddress ? { businessAddress: input.businessAddress.trim() } : {}),
        ...(input.gstNumber !== undefined ? { gstNumber: input.gstNumber?.toUpperCase() || null } : {}),
        ...(input.creditLimit !== undefined ? { creditLimit: new Decimal(input.creditLimit) } : {}),
        ...(input.creditDays !== undefined ? { creditDays: input.creditDays } : {}),
        ...(input.remainingCreditLimit !== undefined
          ? { remainingCreditLimit: new Decimal(input.remainingCreditLimit) }
          : {}),
        ...(input.assignedWarehouseId !== undefined ? { assignedWarehouseId: input.assignedWarehouseId } : {}),
      },
      include: {
        assignedWarehouse: { select: { id: true, name: true, code: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'UPDATE',
        entityType: 'DEALER',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { changes: input },
      },
    });

    return updated;
  }

  // ─── Deactivate Dealer ───────────────────────────────────────

  async deactivateDealer(id: string, adminId: string, ctx: RequestContext) {
    const dealer = await prisma.user.findFirst({
      where: { id, role: UserRole.DEALER },
    });

    if (!dealer) {
      throw AppError.notFound('Dealer not found');
    }

    if (env.DEMO_MODE && ['apex@nextrade.com', 'buildmart@nextrade.com', 'profix@nextrade.com'].includes(dealer.email)) {
      throw AppError.forbidden('Core demo dealer accounts cannot be deactivated in Demo Mode.');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
    });

    // Revoke all active sessions
    await prisma.session.deleteMany({ where: { userId: id } });

    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'DEACTIVATE',
        entityType: 'DEALER',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { dealerEmail: dealer.email },
      },
    });

    return { message: `Dealer "${updated.name}" deactivated` };
  }

  // ─── Reactivate Dealer ───────────────────────────────────────

  async reactivateDealer(id: string, adminId: string, ctx: RequestContext) {
    const dealer = await prisma.user.findFirst({
      where: { id, role: UserRole.DEALER },
    });

    if (!dealer) {
      throw AppError.notFound('Dealer not found');
    }

    if (dealer.status !== UserStatus.INACTIVE) {
      throw AppError.badRequest('Only inactive dealers can be reactivated');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: UserStatus.APPROVED },
    });

    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'REACTIVATE',
        entityType: 'DEALER',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { dealerEmail: dealer.email },
      },
    });

    return { message: `Dealer "${updated.name}" reactivated` };
  }

  // ─── Category Discount Matrix ────────────────────────────────

  async getDiscounts(dealerId: string) {
    const dealer = await prisma.user.findFirst({
      where: { id: dealerId, role: UserRole.DEALER },
    });
    if (!dealer) throw AppError.notFound('Dealer not found');

    return prisma.dealerCategoryDiscount.findMany({
      where: { dealerId },
      include: {
        category: { select: { id: true, name: true, slug: true, level: true } },
      },
      orderBy: { category: { name: 'asc' } },
    });
  }

  async setDiscount(dealerId: string, input: SetDiscountInput, adminId: string, ctx: RequestContext) {
    const [dealer, category] = await Promise.all([
      prisma.user.findFirst({ where: { id: dealerId, role: UserRole.DEALER } }),
      prisma.category.findUnique({ where: { id: input.categoryId } }),
    ]);

    if (!dealer) throw AppError.notFound('Dealer not found');
    if (!category) throw AppError.notFound('Category not found');

    const discount = await prisma.dealerCategoryDiscount.upsert({
      where: {
        dealerId_categoryId: {
          dealerId,
          categoryId: input.categoryId,
        },
      },
      create: {
        dealerId,
        categoryId: input.categoryId,
        discountPercentage: new Decimal(input.discountPercentage),
      },
      update: {
        discountPercentage: new Decimal(input.discountPercentage),
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'SET_DISCOUNT',
        entityType: 'DEALER_DISCOUNT',
        entityId: discount.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: {
          dealerName: dealer.name,
          categoryName: category.name,
          discountPercentage: input.discountPercentage,
        },
      },
    });

    return discount;
  }

  async bulkSetDiscounts(dealerId: string, input: BulkDiscountsInput, adminId: string, ctx: RequestContext) {
    const dealer = await prisma.user.findFirst({
      where: { id: dealerId, role: UserRole.DEALER },
    });
    if (!dealer) throw AppError.notFound('Dealer not found');

    const results = await prisma.$transaction(
      input.discounts.map((d) =>
        prisma.dealerCategoryDiscount.upsert({
          where: {
            dealerId_categoryId: {
              dealerId,
              categoryId: d.categoryId,
            },
          },
          create: {
            dealerId,
            categoryId: d.categoryId,
            discountPercentage: new Decimal(d.discountPercentage),
          },
          update: {
            discountPercentage: new Decimal(d.discountPercentage),
          },
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        })
      )
    );

    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'BULK_SET_DISCOUNTS',
        entityType: 'DEALER_DISCOUNT',
        entityId: dealerId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { count: results.length, dealerName: dealer.name },
      },
    });

    return results;
  }

  async removeDiscount(dealerId: string, categoryId: string, adminId: string, ctx: RequestContext) {
    const discount = await prisma.dealerCategoryDiscount.findUnique({
      where: { dealerId_categoryId: { dealerId, categoryId } },
    });

    if (!discount) {
      throw AppError.notFound('Category discount not found for this dealer');
    }

    await prisma.dealerCategoryDiscount.delete({
      where: { id: discount.id },
    });

    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'DELETE_DISCOUNT',
        entityType: 'DEALER_DISCOUNT',
        entityId: discount.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { dealerId, categoryId },
      },
    });

    return { message: 'Category discount removed successfully' };
  }

  // ─── Dealer Self-Service ─────────────────────────────────────

  async getDealerProfile(userPayload: AuthUserPayload) {
    const dealer = await prisma.user.findUnique({
      where: { id: userPayload.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        businessName: true,
        businessAddress: true,
        gstNumber: true,
        creditLimit: true,
        creditDays: true,
        remainingCreditLimit: true,
        assignedWarehouse: { select: { id: true, name: true, code: true } },
        categoryDiscounts: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        createdAt: true,
      },
    });

    if (!dealer) {
      throw AppError.notFound('Dealer account not found');
    }

    return {
      ...dealer,
      isImpersonated: Boolean(userPayload.impersonatedBy),
      impersonatedBy: userPayload.impersonatedBy || null,
    };
  }

  async updateDealerSelf(dealerId: string, input: UpdateDealerSelfInput) {
    const updated = await prisma.user.update({
      where: { id: dealerId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.businessAddress ? { businessAddress: input.businessAddress.trim() } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        businessName: true,
        businessAddress: true,
        gstNumber: true,
        creditLimit: true,
        creditDays: true,
        remainingCreditLimit: true,
      },
    });

    return updated;
  }
}

export const dealersService = new DealersService();
