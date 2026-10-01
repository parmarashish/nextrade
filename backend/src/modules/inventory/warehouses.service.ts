import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/app-error.js';
import { CreateWarehouseInput, UpdateWarehouseInput } from './warehouses.dto.js';
import { AuthUserPayload, RequestContext } from '../../common/types.js';
import { UserRole } from '@prisma/client';

export class WarehousesService {
  // ─── Generate Warehouse Code: WH-{CITY}-{SEQ} ────────────────

  private async generateWarehouseCode(city: string): Promise<string> {
    const cleanCity = city.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const cityCode = cleanCity.slice(0, 3).padEnd(3, 'X');
    const prefix = `WH-${cityCode}-`;

    const last = await prisma.warehouse.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let nextNum = 1;
    if (last) {
      const parts = last.code.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextNum = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextNum).padStart(2, '0')}`;
  }

  // ─── List Warehouses (Role-aware) ────────────────────────────

  async findAll(user: AuthUserPayload) {
    if (user.role === UserRole.DEALER) {
      if (user.assignedWarehouseId) {
        return prisma.warehouse.findMany({
          where: { id: user.assignedWarehouseId, isActive: true },
        });
      }
      // If dealer has no assigned warehouse, show active warehouses (e.g. primary)
      return prisma.warehouse.findMany({
        where: { isActive: true },
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      });
    }

    // Admin sees all warehouses
    const warehouses = await prisma.warehouse.findMany({
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { stocks: true, orders: true },
        },
        stocks: {
          select: {
            quantity: true,
            reservedQuantity: true,
            reorderPoint: true,
            productVariant: {
              select: {
                price: true,
                costPrice: true,
              },
            },
          },
        },
      },
    });

    return warehouses.map((w) => {
      let totalStock = 0;
      let stockValue = 0;
      let lowStockCount = 0;

      w.stocks.forEach((s) => {
        const avail = Math.max(0, s.quantity - s.reservedQuantity);
        totalStock += avail;
        const unitCost = s.productVariant.costPrice
          ? Number(s.productVariant.costPrice)
          : Number(s.productVariant.price);
        stockValue += s.quantity * unitCost;
        if (avail <= s.reorderPoint) {
          lowStockCount++;
        }
      });

      const { stocks, ...rest } = w;
      return {
        ...rest,
        totalProducts: w._count.stocks,
        totalStock,
        stockValue: Math.round(stockValue * 100) / 100,
        lowStockCount,
      };
    });
  }

  // ─── Get Single Warehouse ────────────────────────────────────

  async findById(id: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        _count: {
          select: { stocks: true, orders: true },
        },
      },
    });

    if (!warehouse) {
      throw AppError.notFound('Warehouse not found');
    }

    return warehouse;
  }

  // ─── Warehouse Summary Metrics ───────────────────────────────

  async getSummary(id: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        contactPerson: true,
        contactPhone: true,
        isPrimary: true,
        isActive: true,
      },
    });

    if (!warehouse) {
      throw AppError.notFound('Warehouse not found');
    }

    const stocks = await prisma.warehouseStock.findMany({
      where: { warehouseId: id },
      include: {
        productVariant: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            costPrice: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { productVariant: { name: 'asc' } },
    });

    let totalPhysicalStock = 0;
    let totalReservedStock = 0;
    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const items = stocks.map((s) => {
      totalPhysicalStock += s.quantity;
      totalReservedStock += s.reservedQuantity;

      const unitCost = s.productVariant.costPrice
        ? Number(s.productVariant.costPrice)
        : Number(s.productVariant.price);

      totalStockValue += s.quantity * unitCost;

      const available = Math.max(0, s.quantity - s.reservedQuantity);
      let status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (available <= 0) {
        outOfStockCount++;
        status = 'OUT_OF_STOCK';
      } else if (available <= s.reorderPoint) {
        lowStockCount++;
        status = 'LOW_STOCK';
      }

      return {
        id: s.id,
        productId: s.productVariant.product?.id,
        productName: s.productVariant.product?.name || 'Product',
        variantId: s.productVariant.id,
        variantName: s.productVariant.name,
        variantSku: s.productVariant.sku,
        physicalQuantity: s.quantity,
        reservedQuantity: s.reservedQuantity,
        availableQuantity: available,
        reorderPoint: s.reorderPoint,
        status,
      };
    });

    return {
      warehouse,
      totalVariantsStocked: stocks.length,
      totalPhysicalStock,
      totalReservedStock,
      totalAvailableStock: Math.max(0, totalPhysicalStock - totalReservedStock),
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      lowStockCount,
      outOfStockCount,
      items,
    };
  }

  // ─── Create Warehouse (Admin Only) ───────────────────────────

  async create(input: CreateWarehouseInput, userId: string, ctx: RequestContext) {
    const code = input.code || (await this.generateWarehouseCode(input.city));

    const existingCode = await prisma.warehouse.findUnique({ where: { code } });
    if (existingCode) {
      throw AppError.conflict(`Warehouse code "${code}" is already in use`);
    }

    // Ensure only one warehouse is primary
    if (input.isPrimary) {
      await prisma.warehouse.updateMany({
        where: { isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: input.name.trim(),
        code,
        address: input.address.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        pincode: input.pincode.trim(),
        contactPerson: input.contactPerson?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        isPrimary: input.isPrimary ?? false,
        isActive: input.isActive ?? true,
        invoiceSettings: input.invoiceSettings || {
          prefix: `INV-${code.replace('WH-', '')}-`,
          padding: 5,
          reset: 'YEARLY',
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'CREATE',
        entityType: 'WAREHOUSE',
        entityId: warehouse.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { name: warehouse.name, code: warehouse.code },
      },
    });

    return warehouse;
  }

  // ─── Update Warehouse (Admin Only) ───────────────────────────

  async update(id: string, input: UpdateWarehouseInput, userId: string, ctx: RequestContext) {
    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('Warehouse not found');
    }

    if (input.code && input.code !== existing.code) {
      const codeCheck = await prisma.warehouse.findUnique({ where: { code: input.code } });
      if (codeCheck) {
        throw AppError.conflict(`Warehouse code "${input.code}" is already in use`);
      }
    }

    if (input.isPrimary) {
      await prisma.warehouse.updateMany({
        where: { id: { not: id }, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.code ? { code: input.code.trim() } : {}),
        ...(input.address ? { address: input.address.trim() } : {}),
        ...(input.city ? { city: input.city.trim() } : {}),
        ...(input.state ? { state: input.state.trim() } : {}),
        ...(input.pincode ? { pincode: input.pincode.trim() } : {}),
        ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson?.trim() || null } : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone?.trim() || null } : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.invoiceSettings !== undefined ? { invoiceSettings: input.invoiceSettings } : {}),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entityType: 'WAREHOUSE',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { changes: input },
      },
    });

    return updated;
  }

  // ─── Delete Warehouse (Admin Only) ───────────────────────────

  async delete(id: string, userId: string, ctx: RequestContext) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        stocks: {
          where: {
            OR: [{ quantity: { gt: 0 } }, { reservedQuantity: { gt: 0 } }],
          },
        },
        orders: { select: { id: true } },
      },
    });

    if (!warehouse) {
      throw AppError.notFound('Warehouse not found');
    }

    if (warehouse.stocks.length > 0) {
      throw AppError.badRequest(
        `Cannot delete warehouse "${warehouse.name}" because it holds active physical or reserved inventory.`
      );
    }

    if (warehouse.orders.length > 0) {
      throw AppError.badRequest(
        `Cannot delete warehouse "${warehouse.name}" because it is referenced in ${warehouse.orders.length} order(s).`
      );
    }

    await prisma.warehouse.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        userId,
        action: 'DELETE',
        entityType: 'WAREHOUSE',
        entityId: id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        details: { name: warehouse.name, code: warehouse.code },
      },
    });

    return { message: `Warehouse "${warehouse.name}" deleted successfully` };
  }
}

export const warehousesService = new WarehousesService();
