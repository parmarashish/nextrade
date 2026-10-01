import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/app-error.js';
import {
  InventoryQueryParams,
  MovementQueryParams,
  StockAdjustInput,
  StockTransferInput,
} from './inventory.dto.js';
import { StockMovementType, UserRole } from '@prisma/client';
import { RequestContext } from '../../common/types.js';

export class InventoryService {
  // ─── List Inventory with Stock Status ────────────────────────

  async getInventory(query: InventoryQueryParams, role: UserRole = UserRole.DEALER) {
    const isAdmin = role === UserRole.ADMIN;
    const { page = 1, limit = 50, warehouseId, categoryId, search, stockStatus } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (categoryId) {
      where.productVariant = {
        product: { categoryId },
      };
    }
    if (search) {
      where.OR = [
        { productVariant: { name: { contains: search, mode: 'insensitive' } } },
        { productVariant: { sku: { contains: search, mode: 'insensitive' } } },
        { productVariant: { product: { name: { contains: search, mode: 'insensitive' } } } },
        { warehouse: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [stocks, total] = await Promise.all([
      prisma.warehouseStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ warehouse: { name: 'asc' } }, { productVariant: { name: 'asc' } }],
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          productVariant: {
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
              ...(isAdmin ? { costPrice: true } : {}),
              gstPercentage: true,
              packingDetails: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.warehouseStock.count({ where }),
    ]);

    const formatted = stocks.map((s) => {
      const available = Math.max(0, s.quantity - s.reservedQuantity);
      let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

      if (available <= 0) {
        status = 'OUT_OF_STOCK';
      } else if (available <= s.reorderPoint) {
        status = 'LOW_STOCK';
      } else {
        status = 'IN_STOCK';
      }

      return {
        id: s.id,
        warehouseId: s.warehouseId,
        warehouse: s.warehouse,
        productVariantId: s.productVariantId,
        productVariant: s.productVariant,
        physicalQuantity: s.quantity,
        reservedQuantity: s.reservedQuantity,
        availableQuantity: available,
        reorderPoint: s.reorderPoint,
        stockStatus: status,
        updatedAt: s.updatedAt,
      };
    });

    const filtered = stockStatus
      ? formatted.filter((item) => item.stockStatus === stockStatus)
      : formatted;

    return {
      data: filtered,
      meta: {
        total: stockStatus ? filtered.length : total,
        page,
        limit,
        totalPages: Math.ceil((stockStatus ? filtered.length : total) / limit),
      },
    };
  }

  // ─── Low Stock Alerts ────────────────────────────────────────

  async getAlerts(warehouseId?: string) {
    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;

    const stocks = await prisma.warehouseStock.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        productVariant: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    const alerts = stocks
      .filter((s) => s.quantity - s.reservedQuantity <= s.reorderPoint)
      .map((s) => ({
        id: s.id,
        warehouse: s.warehouse,
        productVariant: s.productVariant,
        physicalQuantity: s.quantity,
        reservedQuantity: s.reservedQuantity,
        availableQuantity: Math.max(0, s.quantity - s.reservedQuantity),
        reorderPoint: s.reorderPoint,
        severity: s.quantity - s.reservedQuantity <= 0 ? 'CRITICAL' : 'WARNING',
      }))
      .sort((a, b) => a.availableQuantity - b.availableQuantity);

    return alerts;
  }

  // ─── Adjust Stock (Admin Only) ───────────────────────────────

  async adjustStock(input: StockAdjustInput, userId: string, ctx: RequestContext) {
    const { warehouseId, productVariantId, quantity, type, notes } = input;

    // Verify warehouse and variant exist
    const [warehouse, variant] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true, name: true } }),
      prisma.productVariant.findUnique({
        where: { id: productVariantId },
        select: { id: true, name: true, sku: true, product: { select: { name: true } } },
      }),
    ]);

    if (!warehouse) throw AppError.notFound('Warehouse not found');
    if (!variant) throw AppError.notFound('Product variant not found');

    return prisma.$transaction(async (tx) => {
      let currentStock = await tx.warehouseStock.findUnique({
        where: { warehouseId_productVariantId: { warehouseId, productVariantId } },
      });

      if (!currentStock) {
        currentStock = await tx.warehouseStock.create({
          data: { warehouseId, productVariantId, quantity: 0, reservedQuantity: 0 },
        });
      }

      let newQuantity: number;
      let movementType: StockMovementType;
      let movementQty: number;

      if (type === 'IN') {
        if (quantity <= 0) throw AppError.badRequest('Inbound quantity must be positive');
        newQuantity = currentStock.quantity + quantity;
        movementType = StockMovementType.IN;
        movementQty = quantity;
      } else if (type === 'OUT') {
        if (quantity <= 0) throw AppError.badRequest('Outbound quantity must be positive');
        if (currentStock.quantity - quantity < 0) {
          throw AppError.badRequest(
            `Cannot reduce stock by ${quantity}. Current physical quantity is ${currentStock.quantity}.`
          );
        }
        if (currentStock.quantity - quantity < currentStock.reservedQuantity) {
          throw AppError.badRequest(
            `Cannot reduce stock below reserved quantity (${currentStock.reservedQuantity}). Available: ${currentStock.quantity - currentStock.reservedQuantity}.`
          );
        }
        newQuantity = currentStock.quantity - quantity;
        movementType = StockMovementType.OUT;
        movementQty = quantity;
      } else {
        // ADJUSTMENT (sets absolute target count)
        if (quantity < 0) throw AppError.badRequest('Stock quantity cannot be negative');
        if (quantity < currentStock.reservedQuantity) {
          throw AppError.badRequest(
            `Cannot set physical stock to ${quantity} because ${currentStock.reservedQuantity} are currently reserved for orders.`
          );
        }
        movementQty = Math.abs(quantity - currentStock.quantity);
        newQuantity = quantity;
        movementType = StockMovementType.ADJUSTMENT;
      }

      const updatedStock = await tx.warehouseStock.update({
        where: { id: currentStock.id },
        data: { quantity: newQuantity },
      });

      // Create Stock Movement Audit Record
      const movement = await tx.stockMovement.create({
        data: {
          warehouseId,
          productVariantId,
          quantity: movementQty,
          type: movementType,
          referenceType: 'MANUAL_ADJUSTMENT',
          referenceId: null,
          notes: notes?.trim() || null,
          performedById: userId,
        },
      });

      // Activity Log
      await tx.activityLog.create({
        data: {
          userId,
          action: 'ADJUST_STOCK',
          entityType: 'INVENTORY',
          entityId: updatedStock.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: {
            warehouseName: warehouse.name,
            variantSku: variant.sku,
            type,
            previousQuantity: currentStock.quantity,
            newQuantity,
            movementId: movement.id,
          },
        },
      });

      return {
        stock: updatedStock,
        movement,
        previousQuantity: currentStock.quantity,
        newQuantity,
      };
    });
  }

  // ─── Transfer Stock Between Warehouses (Atomic) ──────────────

  async transferStock(input: StockTransferInput, userId: string, ctx: RequestContext) {
    const { fromWarehouseId, toWarehouseId, productVariantId, quantity, notes } = input;

    const [fromWH, toWH, variant] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: fromWarehouseId }, select: { id: true, name: true, code: true } }),
      prisma.warehouse.findUnique({ where: { id: toWarehouseId }, select: { id: true, name: true, code: true } }),
      prisma.productVariant.findUnique({ where: { id: productVariantId }, select: { id: true, name: true, sku: true } }),
    ]);

    if (!fromWH) throw AppError.notFound('Source warehouse not found');
    if (!toWH) throw AppError.notFound('Destination warehouse not found');
    if (!variant) throw AppError.notFound('Product variant not found');

    const transferRef = `TRF-${Date.now()}`;

    return prisma.$transaction(async (tx) => {
      const sourceStock = await tx.warehouseStock.findUnique({
        where: {
          warehouseId_productVariantId: {
            warehouseId: fromWarehouseId,
            productVariantId,
          },
        },
      });

      const availableInSource = sourceStock
        ? sourceStock.quantity - sourceStock.reservedQuantity
        : 0;

      if (availableInSource < quantity) {
        throw AppError.badRequest(
          `Insufficient available stock in source warehouse "${fromWH.name}". Available: ${availableInSource}, Requested: ${quantity}.`
        );
      }

      // 1. Deduct from Source
      const updatedSource = await tx.warehouseStock.update({
        where: { id: sourceStock!.id },
        data: { quantity: { decrement: quantity } },
      });

      // 2. Add to Destination (upsert)
      const updatedDest = await tx.warehouseStock.upsert({
        where: {
          warehouseId_productVariantId: {
            warehouseId: toWarehouseId,
            productVariantId,
          },
        },
        create: {
          warehouseId: toWarehouseId,
          productVariantId,
          quantity,
          reservedQuantity: 0,
        },
        update: {
          quantity: { increment: quantity },
        },
      });

      // 3. Create OUT movement for Source
      const outMovement = await tx.stockMovement.create({
        data: {
          warehouseId: fromWarehouseId,
          productVariantId,
          quantity,
          type: StockMovementType.OUT,
          referenceType: 'WAREHOUSE_TRANSFER',
          referenceId: transferRef,
          notes: notes ? `${notes} (Transfer to ${toWH.code})` : `Transfer to ${toWH.name} (${toWH.code})`,
          performedById: userId,
        },
      });

      // 4. Create IN movement for Destination
      const inMovement = await tx.stockMovement.create({
        data: {
          warehouseId: toWarehouseId,
          productVariantId,
          quantity,
          type: StockMovementType.IN,
          referenceType: 'WAREHOUSE_TRANSFER',
          referenceId: transferRef,
          notes: notes ? `${notes} (Transfer from ${fromWH.code})` : `Transfer from ${fromWH.name} (${fromWH.code})`,
          performedById: userId,
        },
      });

      // 5. Activity Log
      await tx.activityLog.create({
        data: {
          userId,
          action: 'TRANSFER_STOCK',
          entityType: 'INVENTORY',
          entityId: transferRef,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          details: {
            fromWarehouse: fromWH.code,
            toWarehouse: toWH.code,
            variantSku: variant.sku,
            quantity,
            transferRef,
          },
        },
      });

      return {
        transferRef,
        quantity,
        source: { warehouse: fromWH, newQuantity: updatedSource.quantity },
        destination: { warehouse: toWH, newQuantity: updatedDest.quantity },
        movements: [outMovement, inMovement],
      };
    });
  }

  // ─── Stock Movement Audit Trail ──────────────────────────────

  async getMovements(query: MovementQueryParams) {
    const { page = 1, limit = 50, warehouseId, productVariantId, type, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (productVariantId) where.productVariantId = productVariantId;
    if (type) where.type = type;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          productVariant: {
            select: {
              id: true,
              name: true,
              sku: true,
              product: { select: { id: true, name: true } },
            },
          },
          performedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      data: movements,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const inventoryService = new InventoryService();
