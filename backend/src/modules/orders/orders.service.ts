import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/app-error.js';
import { CheckoutInput, OrderQueryParams } from './orders.dto.js';
import { AuthUserPayload, RequestContext } from '../../common/types.js';
import { PriceCalculator } from './utils/price-calculator.js';
import { generateOrderNumber } from './utils/order-numbering.js';
import { OrderStatus, PaymentStatus, StockMovementType, UserRole, UserStatus } from '@prisma/client';

export class OrdersService {
  // ─── Checkout (Dealer Places Order) ──────────────────────────

  async checkout(user: AuthUserPayload, input: CheckoutInput, ctx: RequestContext) {
    const dealer = await prisma.user.findUnique({
      where: { id: user.id },
      include: { assignedWarehouse: true },
    });

    if (!dealer || dealer.role !== UserRole.DEALER) {
      throw AppError.forbidden('Only dealers can place orders');
    }

    if (dealer.status !== UserStatus.APPROVED) {
      throw AppError.forbidden('Your account must be APPROVED to place orders');
    }

    const warehouseId = input.warehouseId || dealer.assignedWarehouseId;
    if (!warehouseId) {
      throw AppError.badRequest('No warehouse assigned or specified for this order');
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId, isActive: true },
    });
    if (!warehouse) {
      throw AppError.notFound('Warehouse not found or inactive');
    }

    // 1. Fetch Cart Items
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: user.id },
      include: {
        productVariant: {
          include: {
            product: { select: { id: true, name: true, categoryId: true } },
          },
        },
      },
    });

    if (cartItems.length === 0) {
      throw AppError.badRequest('Your cart is empty');
    }

    // 2. Fetch Category Discounts for this dealer
    const categoryDiscounts = await prisma.dealerCategoryDiscount.findMany({
      where: { dealerId: user.id },
      select: { categoryId: true, discountPercentage: true },
    });
    const discountMap = new Map<string, number>();
    categoryDiscounts.forEach((d) =>
      discountMap.set(d.categoryId, Number(d.discountPercentage))
    );

    // 3. Server-side Price Calculation (Never trust client prices)
    let subtotal = 0;
    let totalDiscount = 0;
    let totalGST = 0;

    const orderItemsData = cartItems.map((item) => {
      const v = item.productVariant;
      const originalUnitPrice = Number(v.price);
      const discountPercent = discountMap.get(v.product.categoryId) || 0;
      const gstPercentage = Number(v.gstPercentage);

      const pricing = PriceCalculator.calculateItemPricing({
        originalUnitPrice,
        dealerDiscountPercent: discountPercent,
        gstPercentage,
        quantity: item.quantity,
      });

      subtotal += pricing.itemTotal;
      totalDiscount += pricing.discountAmount;
      totalGST += pricing.gstAmount;

      return {
        productVariantId: v.id,
        quantity: item.quantity,
        originalUnitPrice: new Decimal(originalUnitPrice),
        dealerDiscount: new Decimal(discountPercent),
        unitPrice: new Decimal(pricing.unitPrice),
        gstPercentage: new Decimal(gstPercentage),
        gstAmount: new Decimal(pricing.gstAmount),
        total: new Decimal(pricing.itemTotal),
      };
    });

    subtotal = PriceCalculator.round2(subtotal);
    totalDiscount = PriceCalculator.round2(totalDiscount);
    totalGST = PriceCalculator.round2(totalGST);
    const grandTotal = PriceCalculator.round2(subtotal + totalGST);

    // 4. Enforce Credit Limit Check
    const remainingCredit = Number(dealer.remainingCreditLimit || 0);
    if (grandTotal > remainingCredit) {
      throw AppError.badRequest(
        `Credit limit exceeded. Order Total: ₹${grandTotal.toLocaleString('en-IN')}, Remaining Credit Limit: ₹${remainingCredit.toLocaleString('en-IN')}`
      );
    }

    // Prepare Shipping Address
    const shippingAddress = input.shippingAddress || {
      name: dealer.name,
      phone: dealer.phone || 'N/A',
      address: dealer.businessAddress || 'N/A',
      city: '',
      state: '',
      pincode: '',
    };

    // 5. Interactive Transaction: Reserve Stock + Create Order + Deduct Credit
    return prisma.$transaction(async (tx) => {
      // 5a. Check Stock Availability Pre-check
      for (const item of cartItems) {
        const stock = await tx.warehouseStock.findUnique({
          where: {
            warehouseId_productVariantId: {
              warehouseId,
              productVariantId: item.productVariantId,
            },
          },
        });

        const available = stock ? stock.quantity - stock.reservedQuantity : 0;
        if (available < item.quantity) {
          throw AppError.badRequest(
            `Insufficient stock for "${item.productVariant.product.name} - ${item.productVariant.name}". Available: ${available}, Requested: ${item.quantity}`
          );
        }
      }

      // 5b. Generate Sequential Race-Free Order Number with Advisory Lock
      const orderNumber = await generateOrderNumber(tx);

      // 5c. Create Order & Items
      const order = await tx.order.create({
        data: {
          orderNumber,
          dealerId: dealer.id,
          warehouseId,
          status: OrderStatus.PENDING,
          subtotal: new Decimal(subtotal),
          discount: new Decimal(totalDiscount),
          totalGST: new Decimal(totalGST),
          grandTotal: new Decimal(grandTotal),
          paymentStatus: PaymentStatus.PENDING,
          shippingAddress: shippingAddress as any,
          notes: input.notes?.trim() || null,
          creditDaysForOrder: dealer.creditDays || 30,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: {
              productVariant: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      });

      // 5d. Atomic Stock Reservation (Sort by productVariantId to eliminate deadlock risk)
      const sortedItems = [...cartItems].sort((a, b) =>
        a.productVariantId.localeCompare(b.productVariantId)
      );

      for (const item of sortedItems) {
        const updatedCount = await tx.$executeRaw`
          UPDATE "warehouse_stocks"
          SET "reservedQuantity" = "reservedQuantity" + ${item.quantity}
          WHERE "warehouseId" = ${warehouseId}
            AND "productVariantId" = ${item.productVariantId}
            AND "quantity" - "reservedQuantity" >= ${item.quantity}
        `;

        if (updatedCount === 0) {
          throw AppError.badRequest(
            `Stock reservation failed for item "${item.productVariant.name}". Stock was reserved by another order.`
          );
        }

        // Record stock movement
        await tx.stockMovement.create({
          data: {
            warehouseId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            type: StockMovementType.RESERVED,
            referenceType: 'ORDER',
            referenceId: order.orderNumber,
            notes: `Stock reserved for Order #${order.orderNumber}`,
            performedById: dealer.id,
          },
        });
      }

      // 5e. Deduct Grand Total from Dealer's Remaining Credit Limit
      // Atomic + race-safe: only deducts if enough credit remains at write time
      const creditUpdated = await tx.$executeRaw`
        UPDATE "users"
        SET "remainingCreditLimit" = "remainingCreditLimit" - CAST(${grandTotal} AS DECIMAL(12,2))
        WHERE "id" = ${dealer.id}
          AND "remainingCreditLimit" >= CAST(${grandTotal} AS DECIMAL(12,2))
      `;
      if (creditUpdated !== 1) {
        throw AppError.badRequest('Credit limit exceeded. Your remaining credit changed while placing this order.');
      }

      // 5f. Clear Dealer's Cart
      await tx.cartItem.deleteMany({ where: { userId: dealer.id } });

      // 5g. Activity Log
      await tx.activityLog.create({
        data: {
          userId: dealer.id,
          action: 'CREATE',
          entityType: 'ORDER',
          entityId: order.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: {
            orderNumber: order.orderNumber,
            grandTotal,
            itemCount: order.items.length,
          },
        },
      });

      return order;
    });
  }

  // ─── List Orders (Role-Aware with Status Counts) ──────────────

  async findAll(query: OrderQueryParams, user: AuthUserPayload) {
    const {
      page = 1,
      limit = 50,
      status,
      paymentStatus,
      dealerId,
      warehouseId,
      search,
      dateFrom,
      dateTo,
    } = query;
    const skip = (page - 1) * limit;

    const baseWhere: any = {};
    if (user.role === UserRole.DEALER) {
      baseWhere.dealerId = user.id;
    } else if (dealerId) {
      baseWhere.dealerId = dealerId;
    }

    if (warehouseId) baseWhere.warehouseId = warehouseId;
    if (search) {
      baseWhere.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { dealer: { name: { contains: search, mode: 'insensitive' } } },
        { dealer: { businessName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (dateFrom || dateTo) {
      baseWhere.createdAt = {};
      if (dateFrom) baseWhere.createdAt.gte = new Date(dateFrom);
      if (dateTo) baseWhere.createdAt.lte = new Date(dateTo);
    }

    // Status Tab Counts
    const [
      allCount,
      pendingCount,
      confirmedCount,
      processingCount,
      partiallyDispatchedCount,
      dispatchedCount,
      deliveredCount,
      cancelledCount,
    ] = await Promise.all([
      prisma.order.count({ where: { ...baseWhere } }),
      prisma.order.count({ where: { ...baseWhere, status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { ...baseWhere, status: OrderStatus.CONFIRMED } }),
      prisma.order.count({ where: { ...baseWhere, status: OrderStatus.PROCESSING } }),
      prisma.order.count({ where: { ...baseWhere, status: OrderStatus.PARTIALLY_DISPATCHED } }),
      prisma.order.count({ where: { ...baseWhere, status: OrderStatus.DISPATCHED } }),
      prisma.order.count({ where: { ...baseWhere, status: OrderStatus.DELIVERED } }),
      prisma.order.count({ where: { ...baseWhere, status: OrderStatus.CANCELLED } }),
    ]);

    const where = { ...baseWhere };
    if (status !== 'ALL') where.status = status as OrderStatus;
    if (paymentStatus !== 'ALL') where.paymentStatus = paymentStatus as PaymentStatus;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          dealer: { select: { id: true, name: true, businessName: true, email: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { items: true, dispatches: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      counts: {
        all: allCount,
        pending: pendingCount,
        confirmed: confirmedCount,
        processing: processingCount,
        partiallyDispatched: partiallyDispatchedCount,
        dispatched: dispatchedCount,
        delivered: deliveredCount,
        cancelled: cancelledCount,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Get Single Order By ID ──────────────────────────────────

  async findById(id: string, user: AuthUserPayload) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        dealer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            businessName: true,
            businessAddress: true,
            gstNumber: true,
          },
        },
        warehouse: {
          select: { id: true, name: true, code: true, address: true, city: true, state: true },
        },
        items: {
          include: {
            productVariant: {
              select: {
                id: true,
                name: true,
                sku: true,
                packingDetails: true,
                product: { select: { id: true, name: true, images: true } },
              },
            },
            dispatchItems: {
              select: {
                quantity: true,
                dispatch: { select: { status: true } },
              },
            },
          },
        },
        dispatches: {
          select: {
            id: true,
            dispatchNumber: true,
            status: true,
            trackingNumber: true,
            courierName: true,
            dispatchedAt: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            referenceId: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw AppError.notFound('Order not found');
    }

    if (user.role === UserRole.DEALER && order.dealerId !== user.id) {
      throw AppError.forbidden('Access denied to this order');
    }

    return order;
  }

  // ─── Confirm Order (Admin Only) ──────────────────────────────

  async confirmOrder(id: string, adminId: string, ctx: RequestContext) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) throw AppError.notFound('Order not found');

    if (order.status !== OrderStatus.PENDING) {
      throw AppError.badRequest(`Cannot confirm order in '${order.status}' status. Only PENDING orders can be confirmed.`);
    }

    const confirmed = await prisma.order.updateMany({
      where: { id, status: OrderStatus.PENDING },
      data: { status: OrderStatus.CONFIRMED },
    });
    if (confirmed.count === 0) {
      throw AppError.badRequest('Order status changed; it can no longer be confirmed.');
    }
    const updated = await prisma.order.findUniqueOrThrow({ where: { id } });

    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'CONFIRM',
        entityType: 'ORDER',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { orderNumber: order.orderNumber, status: 'CONFIRMED' },
      },
    });

    return updated;
  }

  // ─── Cancel Order (Releases Stock & Restores Credit) ─────────

  async cancelOrder(id: string, userId: string, ctx: RequestContext, userRole?: UserRole) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) throw AppError.notFound('Order not found');

    if (userRole === UserRole.DEALER) {
      if (order.dealerId !== userId) {
        throw AppError.forbidden('Access denied to cancel this order');
      }
      if (order.status !== OrderStatus.PENDING) {
        throw AppError.badRequest(`Dealers can only cancel orders in PENDING status. Order is currently '${order.status}'.`);
      }
    } else {
      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
        throw AppError.badRequest(`Cannot cancel order in '${order.status}' status.`);
      }
    }

    const allowedStatuses: OrderStatus[] =
      userRole === UserRole.DEALER
        ? [OrderStatus.PENDING]
        : [OrderStatus.PENDING, OrderStatus.CONFIRMED];

    return prisma.$transaction(async (tx) => {
      // 0. Atomic status transition — only one concurrent request can win
      const transitioned = await tx.order.updateMany({
        where: {
          id,
          status: { in: allowedStatuses },
          ...(userRole === UserRole.DEALER ? { dealerId: userId } : {}),
        },
        data: { status: OrderStatus.CANCELLED },
      });
      if (transitioned.count === 0) {
        throw AppError.badRequest('Order cannot be cancelled (already cancelled or status changed)');
      }

      // 1. Release Reserved Stock in Raw SQL
      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE "warehouse_stocks"
          SET "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${item.quantity})
          WHERE "warehouseId" = ${order.warehouseId}
            AND "productVariantId" = ${item.productVariantId}
        `;

        await tx.stockMovement.create({
          data: {
            warehouseId: order.warehouseId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            type: StockMovementType.RELEASED,
            referenceType: 'ORDER',
            referenceId: order.orderNumber,
            notes: `Stock reservation released on Order #${order.orderNumber} cancellation`,
            performedById: userId,
          },
        });
      }

      // 2. Restore Dealer Remaining Credit Limit
      await tx.user.update({
        where: { id: order.dealerId },
        data: {
          remainingCreditLimit: {
            increment: order.grandTotal,
          },
        },
      });

      // 3. Update Order Status
      const cancelledOrder = await tx.order.findUniqueOrThrow({ where: { id } });

      // 4. Activity Log
      await tx.activityLog.create({
        data: {
          userId: userId,
          action: 'CANCEL',
          entityType: 'ORDER',
          entityId: id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: {
            orderNumber: order.orderNumber,
            grandTotal: Number(order.grandTotal),
            restoredCredit: Number(order.grandTotal),
          },
        },
      });

      return cancelledOrder;
    });
  }

  // ─── Add Offline Payment ────────────────────────────────────
  async addPayment(
    orderId: string,
    input: { amount: number; paymentMethod?: string; referenceId?: string; notes?: string },
    user: AuthUserPayload,
    ctx: RequestContext
  ) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw AppError.notFound('Order not found');

    if (user.role === UserRole.DEALER && order.dealerId !== user.id) {
      throw AppError.forbidden('Access denied');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw AppError.badRequest('Cannot add payment to cancelled order');
    }

    const payment = await prisma.payment.create({
      data: {
        orderId,
        dealerId: order.dealerId,
        amount: input.amount,
        paymentMethod: input.paymentMethod || 'BANK_TRANSFER',
        referenceId: input.referenceId || null,
        notes: input.notes || null,
        paymentSource: user.role === UserRole.DEALER ? 'DEALER' : 'ADMIN',
        status: PaymentStatus.PENDING,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'PAYMENT_SUBMITTED',
        entityType: 'PAYMENT',
        entityId: payment.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: {
          orderNumber: order.orderNumber,
          amount: input.amount,
          referenceId: input.referenceId,
        },
      },
    });

    return payment;
  }
}

export const ordersService = new OrdersService();
