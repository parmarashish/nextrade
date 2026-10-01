import { Prisma, OrderStatus, DispatchStatus, StockMovementType, UserRole } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/app-error.js';
import {
  CreateDispatchInput,
  DispatchQueryParams,
  UpdateTrackingInput,
} from './dispatch.dto.js';
import { AuthUserPayload, RequestContext } from '../../common/types.js';
import { allocateInvoiceNumber } from '../invoices/invoice-numbering.js';

export class DispatchService {
  // ─── Advisory Lock Dispatch Number Generator ─────────────────

  private async generateDispatchNumber(tx: Prisma.TransactionClient): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dispatch_number:nextrade'))`;

    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const prefix = `DSP-${yy}${mm}${dd}`;

    const last = await tx.dispatch.findFirst({
      where: { dispatchNumber: { startsWith: prefix } },
      orderBy: { dispatchNumber: 'desc' },
      select: { dispatchNumber: true },
    });

    let seq = 1;
    if (last) {
      const parts = last.dispatchNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  // ─── Create Dispatch (Admin Only) ────────────────────────────

  async createDispatch(input: CreateDispatchInput, adminId: string, ctx: RequestContext) {
    const { orderId, items, trackingNumber, courierName, notes } = input;

    // 1. Fetch Order with Items & Previous Dispatches
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        warehouse: true,
        items: {
          include: {
            productVariant: { select: { id: true, name: true, sku: true } },
            dispatchItems: {
              include: {
                dispatch: { select: { status: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw AppError.notFound('Order not found');
    }

    const eligibleStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.PARTIALLY_DISPATCHED,
    ];

    if (!eligibleStatuses.includes(order.status)) {
      throw AppError.badRequest(
        `Cannot dispatch order in '${order.status}' status. Order must be CONFIRMED or PROCESSING.`
      );
    }

    // 2. Validate Dispatched Quantities Against Remaining Undispatched
    const orderItemMap = new Map(order.items.map((i) => [i.id, i]));

    for (const item of items) {
      const orderItem = orderItemMap.get(item.orderItemId);
      if (!orderItem) {
        throw AppError.badRequest(`Order item ${item.orderItemId} does not belong to this order`);
      }

      if (orderItem.productVariantId !== item.productVariantId) {
        throw AppError.badRequest('Product variant mismatch for order item');
      }

      // Calculate previously dispatched quantity
      const alreadyDispatched = orderItem.dispatchItems
        .filter((di) => di.dispatch.status !== DispatchStatus.CANCELLED)
        .reduce((sum, di) => sum + di.quantity, 0);

      const remainingUndispatched = orderItem.quantity - alreadyDispatched;

      if (item.quantity > remainingUndispatched) {
        throw AppError.badRequest(
          `Cannot dispatch ${item.quantity} units of "${orderItem.productVariant.name}". Only ${remainingUndispatched} remaining to dispatch (Total: ${orderItem.quantity}, Already Dispatched: ${alreadyDispatched}).`
        );
      }
    }

    // 3. Interactive Transaction: Reserve release + Physical stock deduction + Dispatch creation
    return prisma.$transaction(async (tx) => {
      // 3a. Generate Dispatch Number
      const dispatchNumber = await this.generateDispatchNumber(tx);

      // 3b. Create Dispatch Header
      const dispatch = await tx.dispatch.create({
        data: {
          dispatchNumber,
          orderId: order.id,
          warehouseId: order.warehouseId,
          status: trackingNumber ? DispatchStatus.IN_TRANSIT : DispatchStatus.PENDING,
          trackingNumber: trackingNumber?.trim() || null,
          courierName: courierName?.trim() || null,
          notes: notes?.trim() || null,
          dispatchedAt: new Date(),
          items: {
            create: items.map((i) => ({
              orderItemId: i.orderItemId,
              productVariantId: i.productVariantId,
              quantity: i.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              productVariant: { select: { id: true, name: true, sku: true } },
            },
          },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      });

      // 3c. Deduct Physical Stock and Release Reserved Stock in Raw SQL
      for (const item of items) {
        await tx.$executeRaw`
          UPDATE "warehouse_stocks"
          SET "quantity" = GREATEST(0, "quantity" - ${item.quantity}),
              "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${item.quantity})
          WHERE "warehouseId" = ${order.warehouseId}
            AND "productVariantId" = ${item.productVariantId}
        `;

        // Record stock movement (OUT)
        await tx.stockMovement.create({
          data: {
            warehouseId: order.warehouseId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            type: StockMovementType.OUT,
            referenceType: 'DISPATCH',
            referenceId: dispatch.dispatchNumber,
            notes: `Dispatched in #${dispatch.dispatchNumber} for Order #${order.orderNumber}`,
            performedById: adminId,
          },
        });
      }

      // 3d. Check If Order Is Fully Dispatched or Partially Dispatched
      let totalOrderQuantity = 0;
      let totalDispatchedQuantity = 0;

      order.items.forEach((oi) => {
        totalOrderQuantity += oi.quantity;

        // Dispatches prior to this one
        const priorDispatched = oi.dispatchItems
          .filter((di) => di.dispatch.status !== DispatchStatus.CANCELLED)
          .reduce((sum, di) => sum + di.quantity, 0);

        // Dispatched in this new shipment
        const currentItemDispatch = items.find((i) => i.orderItemId === oi.id)?.quantity || 0;

        totalDispatchedQuantity += priorDispatched + currentItemDispatch;
      });

      const isFullyDispatched = totalDispatchedQuantity >= totalOrderQuantity;
      const newOrderStatus = isFullyDispatched
        ? OrderStatus.DISPATCHED
        : OrderStatus.PARTIALLY_DISPATCHED;

      let invoiceNumber: string | null = order.invoiceNumber;
      if (isFullyDispatched && !invoiceNumber) {
        invoiceNumber = await allocateInvoiceNumber(
          order.warehouseId,
          order.warehouse.code,
          tx
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: newOrderStatus,
          ...(invoiceNumber ? { invoiceNumber } : {}),
        },
      });

      // 3e. Activity Log
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'CREATE',
          entityType: 'DISPATCH',
          entityId: dispatch.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: {
            dispatchNumber: dispatch.dispatchNumber,
            orderNumber: order.orderNumber,
            itemCount: items.length,
            orderStatus: newOrderStatus,
            invoiceNumber,
          },
        },
      });

      return {
        dispatch,
        orderStatus: newOrderStatus,
        isFullyDispatched,
        invoiceNumber,
      };
    });
  }

  // ─── List Dispatches (Role-Aware) ────────────────────────────

  async findAll(query: DispatchQueryParams, user: AuthUserPayload) {
    const { page = 1, limit = 50, status, orderId, search, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const baseWhere: any = {};

    if (user.role === UserRole.DEALER) {
      baseWhere.order = { dealerId: user.id };
    }

    if (orderId) baseWhere.orderId = orderId;

    if (search) {
      baseWhere.OR = [
        { dispatchNumber: { contains: search, mode: 'insensitive' } },
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { courierName: { contains: search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (dateFrom || dateTo) {
      baseWhere.createdAt = {};
      if (dateFrom) baseWhere.createdAt.gte = new Date(dateFrom);
      if (dateTo) baseWhere.createdAt.lte = new Date(dateTo);
    }

    const [allCount, pendingCount, inTransitCount, deliveredCount, cancelledCount] = await Promise.all([
      prisma.dispatch.count({ where: { ...baseWhere } }),
      prisma.dispatch.count({ where: { ...baseWhere, status: DispatchStatus.PENDING } }),
      prisma.dispatch.count({ where: { ...baseWhere, status: DispatchStatus.IN_TRANSIT } }),
      prisma.dispatch.count({ where: { ...baseWhere, status: DispatchStatus.DELIVERED } }),
      prisma.dispatch.count({ where: { ...baseWhere, status: DispatchStatus.CANCELLED } }),
    ]);

    const where = { ...baseWhere };
    if (status !== 'ALL') where.status = status as DispatchStatus;

    const [dispatches, total] = await Promise.all([
      prisma.dispatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              dealer: { select: { id: true, name: true, businessName: true } },
            },
          },
          warehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.dispatch.count({ where }),
    ]);

    return {
      data: dispatches,
      counts: {
        all: allCount,
        pending: pendingCount,
        inTransit: inTransitCount,
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

  // ─── Get Single Dispatch ─────────────────────────────────────

  async findById(id: string, user: AuthUserPayload) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            shippingAddress: true,
            dealerId: true,
            dealer: { select: { id: true, name: true, email: true, phone: true, businessName: true } },
          },
        },
        warehouse: { select: { id: true, name: true, code: true, address: true, city: true } },
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
          },
        },
      },
    });

    if (!dispatch) {
      throw AppError.notFound('Dispatch not found');
    }

    if (user.role === UserRole.DEALER && dispatch.order.dealerId !== user.id) {
      throw AppError.forbidden('Access denied to this dispatch');
    }

    return dispatch;
  }

  // ─── Update Tracking Details (Admin Only) ────────────────────

  async updateTracking(id: string, input: UpdateTrackingInput, adminId: string, ctx: RequestContext) {
    const dispatch = await prisma.dispatch.findUnique({ where: { id } });
    if (!dispatch) throw AppError.notFound('Dispatch not found');

    const newStatus =
      dispatch.status === DispatchStatus.PENDING
        ? DispatchStatus.IN_TRANSIT
        : dispatch.status;

    const updated = await prisma.dispatch.update({
      where: { id },
      data: {
        trackingNumber: input.trackingNumber.trim(),
        courierName: input.courierName.trim(),
        status: newStatus,
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'UPDATE_TRACKING',
        entityType: 'DISPATCH',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: {
          dispatchNumber: dispatch.dispatchNumber,
          trackingNumber: input.trackingNumber,
          courierName: input.courierName,
        },
      },
    });

    return updated;
  }

  // ─── Mark Dispatch Delivered (Admin Only) ────────────────────

  async deliverDispatch(id: string, adminId: string, ctx: RequestContext) {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            dispatches: { select: { id: true, status: true } },
          },
        },
      },
    });

    if (!dispatch) throw AppError.notFound('Dispatch not found');

    if (dispatch.status === DispatchStatus.DELIVERED) {
      return { message: 'Dispatch is already delivered', dispatch };
    }

    return prisma.$transaction(async (tx) => {
      // 1. Mark this dispatch as DELIVERED
      const updatedDispatch = await tx.dispatch.update({
        where: { id },
        data: {
          status: DispatchStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });

      // 2. Check if all dispatches for this order are now DELIVERED
      const order = dispatch.order;
      const otherDispatches = order.dispatches.filter((d) => d.id !== id);
      const allDispatchesDelivered = otherDispatches.every(
        (d) => d.status === DispatchStatus.DELIVERED
      );

      let orderDelivered = false;
      // If all dispatches are delivered and the order was fully DISPATCHED, order transitions to DELIVERED
      if (allDispatchesDelivered && order.status === OrderStatus.DISPATCHED) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.DELIVERED },
        });
        orderDelivered = true;
      }

      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: 'DELIVER',
          entityType: 'DISPATCH',
          entityId: id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: {
            dispatchNumber: dispatch.dispatchNumber,
            orderNumber: order.orderNumber,
            orderDelivered,
          },
        },
      });

      return {
        message: `Dispatch #${dispatch.dispatchNumber} marked as delivered`,
        dispatch: updatedDispatch,
        orderDelivered,
      };
    });
  }
}

export const dispatchService = new DispatchService();
