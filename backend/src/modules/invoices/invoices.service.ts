import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/app-error.js';
import { AuthUserPayload, RequestContext } from '../../common/types.js';
import { InvoiceQueryParams } from './invoices.dto.js';
import { allocateInvoiceNumber } from './invoice-numbering.js';
import { generateInvoicePdfBuffer } from './invoice-pdf.generator.js';

export class InvoicesService {
  // ─── Manually Generate / Finalize Invoice for an Order ───────────

  async generateInvoiceForOrder(
    orderId: string,
    adminId?: string,
    ctx?: RequestContext
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        warehouse: true,
        dealer: true,
        items: {
          include: {
            productVariant: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw AppError.notFound('Order not found');
    }

    const eligibleStatuses: OrderStatus[] = [
      OrderStatus.DISPATCHED,
      OrderStatus.DELIVERED,
    ];

    if (!eligibleStatuses.includes(order.status)) {
      throw AppError.badRequest(
        `Cannot generate invoice for order in '${order.status}' status. Order must be DISPATCHED or DELIVERED.`
      );
    }

    // Idempotent: if already assigned, return as is
    if (order.invoiceNumber) {
      return order;
    }

    // Allocate number in a transaction with advisory lock
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await allocateInvoiceNumber(
        order.warehouseId,
        order.warehouse.code,
        tx
      );

      const updated = await tx.order.update({
        where: { id: order.id },
        data: { invoiceNumber },
        include: {
          warehouse: true,
          dealer: true,
          items: {
            include: {
              productVariant: {
                include: { product: true },
              },
            },
          },
        },
      });

      if (adminId) {
        await tx.activityLog.create({
          data: {
            userId: adminId,
            action: 'GENERATE_INVOICE',
            entityType: 'ORDER',
            entityId: order.id,
            ipAddress: ctx?.ipAddress,
            userAgent: ctx?.userAgent,
            details: {
              orderNumber: order.orderNumber,
              invoiceNumber,
              warehouseCode: order.warehouse.code,
            },
          },
        });
      }

      return updated;
    });

    return updatedOrder;
  }

  // ─── List Invoices (Role-Aware) ──────────────────────────────────

  async findAll(query: InvoiceQueryParams, user: AuthUserPayload) {
    const { page = 1, limit = 50, warehouseId, search, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      invoiceNumber: { not: null },
    };

    if (user.role === UserRole.DEALER) {
      where.dealerId = user.id;
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { dealer: { businessName: { contains: search, mode: 'insensitive' } } },
        { dealer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [invoices, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          invoiceNumber: true,
          status: true,
          paymentStatus: true,
          subtotal: true,
          discount: true,
          totalGST: true,
          grandTotal: true,
          creditDaysForOrder: true,
          createdAt: true,
          dealer: {
            select: {
              id: true,
              name: true,
              businessName: true,
              gstNumber: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
              city: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: invoices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Find Single Invoice ─────────────────────────────────────────

  async findById(idOrInvoiceNumber: string, user: AuthUserPayload) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrInvoiceNumber
      );

    const whereClause: Prisma.OrderWhereInput = isUuid
      ? { id: idOrInvoiceNumber, invoiceNumber: { not: null } }
      : { invoiceNumber: idOrInvoiceNumber };

    const order = await prisma.order.findFirst({
      where: whereClause,
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
        warehouse: true,
        items: {
          include: {
            productVariant: {
              select: {
                id: true,
                name: true,
                sku: true,
                packingDetails: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw AppError.notFound('Invoice not found');
    }

    if (user.role === UserRole.DEALER && order.dealerId !== user.id) {
      throw AppError.forbidden('Access denied to this invoice');
    }

    return order;
  }

  // ─── Generate Invoice PDF Buffer ─────────────────────────────────

  async generatePdf(idOrInvoiceNumber: string, user: AuthUserPayload) {
    const order = await this.findById(idOrInvoiceNumber, user);
    const pdfBuffer = await generateInvoicePdfBuffer(order as any);

    return {
      buffer: pdfBuffer,
      filename: `${order.invoiceNumber || order.orderNumber}.pdf`,
      invoiceNumber: order.invoiceNumber,
    };
  }
}

export const invoicesService = new InvoicesService();
