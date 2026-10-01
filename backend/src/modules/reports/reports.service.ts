import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import {
  CategoryReportQuery,
  DealerReportQuery,
  SalesReportQuery,
} from './reports.dto.js';
import { buildCsv } from './csv-export.helper.js';

export class ReportsService {
  // ─── 1. Summary KPI Dashboard ───────────────────────────────────

  async getSummary() {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
      thisMonthOrders,
      lastMonthOrders,
      pendingOrdersCount,
      lowStockCount,
    ] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: { gte: startOfThisMonth },
          status: { not: OrderStatus.CANCELLED },
        },
        select: { grandTotal: true, status: true },
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          status: { not: OrderStatus.CANCELLED },
        },
        select: { grandTotal: true, status: true },
      }),
      prisma.order.count({
        where: { status: OrderStatus.PENDING },
      }),
      prisma.warehouseStock.count({
        where: {
          quantity: { lte: prisma.warehouseStock.fields.reorderPoint },
        },
      }),
    ]);

    // Revenue for DELIVERED orders this month vs last month
    const thisMonthDeliveredRevenue = thisMonthOrders
      .filter((o) => o.status === OrderStatus.DELIVERED)
      .reduce((sum, o) => sum + Number(o.grandTotal), 0);

    const lastMonthDeliveredRevenue = lastMonthOrders
      .filter((o) => o.status === OrderStatus.DELIVERED)
      .reduce((sum, o) => sum + Number(o.grandTotal), 0);

    const thisMonthOrdersCount = thisMonthOrders.length;
    const lastMonthOrdersCount = lastMonthOrders.length;

    // null = nothing to compare against (avoids a misleading "+100%" when the prior period is empty)
    const calcPercentChange = (curr: number, prev: number): number | null => {
      if (prev === 0) return null;
      return Number((((curr - prev) / prev) * 100).toFixed(2));
    };

    return {
      totalRevenue: Number(thisMonthDeliveredRevenue.toFixed(2)),
      totalOrders: thisMonthOrdersCount,
      pendingOrders: pendingOrdersCount,
      lowStockAlerts: lowStockCount,
      revenueChange: calcPercentChange(thisMonthDeliveredRevenue, lastMonthDeliveredRevenue),
      ordersChange: calcPercentChange(thisMonthOrdersCount, lastMonthOrdersCount),
    };
  }

  // ─── 2. Sales Report ────────────────────────────────────────────

  async getSalesReport(query: SalesReportQuery) {
    const { dateFrom, dateTo, warehouseId } = query;

    const where: Prisma.OrderWhereInput = {
      status: { not: OrderStatus.CANCELLED },
    };

    if (warehouseId) where.warehouseId = warehouseId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const orders = await prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        grandTotal: true,
        createdAt: true,
        warehouseId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const deliveredOrders = orders.filter((o) => o.status === OrderStatus.DELIVERED);
    const totalRevenue = deliveredOrders.reduce(
      (sum, o) => sum + Number(o.grandTotal),
      0
    );

    const totalOrders = orders.length;
    const avgOrderValue =
      deliveredOrders.length > 0
        ? Number((totalRevenue / deliveredOrders.length).toFixed(2))
        : 0;

    // Status breakdown (all statuses)
    const allStatuses = Object.values(OrderStatus);
    const revenueByStatus = allStatuses.map((st) => {
      const matching = orders.filter((o) => o.status === st);
      const val = matching.reduce((sum, o) => sum + Number(o.grandTotal), 0);
      return {
        status: st,
        count: matching.length,
        totalValue: Number(val.toFixed(2)),
      };
    });

    // Last 12 months breakdown
    const now = new Date();
    const monthsMap = new Map<string, { label: string; revenue: number; orderCount: number }>();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`;
      monthsMap.set(key, { label, revenue: 0, orderCount: 0 });
    }

    orders.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const item = monthsMap.get(key);
      if (item) {
        item.orderCount += 1;
        if (o.status === OrderStatus.DELIVERED) {
          item.revenue += Number(o.grandTotal);
        }
      }
    });

    const revenueByMonth = Array.from(monthsMap.entries()).map(([month, data]) => ({
      month,
      label: data.label,
      revenue: Number(data.revenue.toFixed(2)),
      orderCount: data.orderCount,
    }));

    // Top 10 Products by revenue for this query period (DELIVERED orders only)
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          ...where,
          status: OrderStatus.DELIVERED,
        },
      },
      select: {
        quantity: true,
        total: true,
        gstAmount: true,
        productVariant: {
          select: { product: { select: { id: true, name: true } } },
        },
      },
    });

    const productMap = new Map<
      string,
      { productId: string; productName: string; revenue: number; unitsSold: number }
    >();
    for (const item of orderItems) {
      const prod = item.productVariant.product;
      let p = productMap.get(prod.id);
      if (!p) {
        p = {
          productId: prod.id,
          productName: prod.name,
          revenue: 0,
          unitsSold: 0,
        };
        productMap.set(prod.id, p);
      }
      p.revenue += Number(item.total) + Number(item.gstAmount);
      p.unitsSold += item.quantity;
    }

    const topProducts = Array.from(productMap.values())
      .map((p) => ({ ...p, revenue: Number(p.revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders,
      avgOrderValue,
      revenueByMonth,
      revenueByStatus,
      topProducts,
    };
  }

  // ─── 3. Categories Report ───────────────────────────────────────

  async getCategoryReport(query: CategoryReportQuery) {
    const { dateFrom, dateTo } = query;

    const orderWhere: Prisma.OrderWhereInput = {
      status: OrderStatus.DELIVERED,
    };

    if (dateFrom || dateTo) {
      orderWhere.createdAt = {};
      if (dateFrom) orderWhere.createdAt.gte = new Date(dateFrom);
      if (dateTo) orderWhere.createdAt.lte = new Date(dateTo);
    }

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: orderWhere,
      },
      select: {
        quantity: true,
        total: true,
        gstAmount: true,
        order: { select: { id: true } },
        productVariant: {
          select: {
            product: {
              select: { category: { select: { id: true, name: true, level: true } } },
            },
          },
        },
      },
    });

    // Group only by Level 3 (leaf) categories
    const categoryMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        orderIds: Set<string>;
        totalRevenue: number;
        totalUnits: number;
      }
    >();

    for (const item of orderItems) {
      const cat = item.productVariant.product.category;
      if (!cat || cat.level !== 3) continue;

      let entry = categoryMap.get(cat.id);
      if (!entry) {
        entry = {
          categoryId: cat.id,
          categoryName: cat.name,
          orderIds: new Set(),
          totalRevenue: 0,
          totalUnits: 0,
        };
        categoryMap.set(cat.id, entry);
      }

      entry.orderIds.add(item.order.id);
      const lineRevenue = Number(item.total) + Number(item.gstAmount);
      entry.totalRevenue += lineRevenue;
      entry.totalUnits += item.quantity;
    }

    const results = Array.from(categoryMap.values())
      .map((c) => {
        const totalOrders = c.orderIds.size;
        return {
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          totalOrders,
          totalRevenue: Number(c.totalRevenue.toFixed(2)),
          totalUnits: c.totalUnits,
          avgOrderValue:
            totalOrders > 0
              ? Number((c.totalRevenue / totalOrders).toFixed(2))
              : 0,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    return results;
  }

  // ─── 4. Dealers Report ──────────────────────────────────────────

  async getDealerReport(query: DealerReportQuery) {
    const { dateFrom, dateTo, status } = query;

    const userWhere: Prisma.UserWhereInput = {
      role: UserRole.DEALER,
    };

    if (status !== 'ALL') {
      userWhere.status = status;
    }

    const orderWhere: Prisma.OrderWhereInput = {
      status: { not: OrderStatus.CANCELLED },
    };

    if (dateFrom || dateTo) {
      orderWhere.createdAt = {};
      if (dateFrom) orderWhere.createdAt.gte = new Date(dateFrom);
      if (dateTo) orderWhere.createdAt.lte = new Date(dateTo);
    }

    const dealers = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        businessName: true,
        creditLimit: true,
        remainingCreditLimit: true,
        orders: {
          where: orderWhere,
          select: {
            id: true,
            grandTotal: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const report = dealers.map((dealer) => {
      const totalOrders = dealer.orders.length;
      const totalRevenue = dealer.orders.reduce(
        (sum, o) => sum + Number(o.grandTotal),
        0
      );
      const avgOrderValue =
        totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;
      const lastOrderDate =
        dealer.orders.length > 0 ? dealer.orders[0].createdAt : null;

      const creditLimit = Number(dealer.creditLimit || 0);
      const remainingCredit = Number(dealer.remainingCreditLimit || 0);
      const creditUtilization =
        creditLimit > 0
          ? Number((((creditLimit - remainingCredit) / creditLimit) * 100).toFixed(2))
          : 0;

      return {
        dealerId: dealer.id,
        dealerName: dealer.name,
        businessName: dealer.businessName || dealer.name,
        totalOrders,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        avgOrderValue,
        lastOrderDate,
        creditLimit,
        remainingCreditLimit: remainingCredit,
        creditUtilization,
      };
    });

    return report.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  // ─── 5. Inventory Report ────────────────────────────────────────

  async getInventoryReport() {
    const [
      totalProducts,
      totalVariants,
      stocks,
      warehouses,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.productVariant.count({ where: { isActive: true } }),
      prisma.warehouseStock.findMany({
        include: {
          productVariant: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.warehouse.findMany({
        select: { id: true, name: true, code: true },
      }),
    ]);

    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const warehouseMap = new Map<
      string,
      {
        warehouseId: string;
        name: string;
        code: string;
        totalVariants: number;
        totalStock: number;
        stockValue: number;
      }
    >();

    warehouses.forEach((w) => {
      warehouseMap.set(w.id, {
        warehouseId: w.id,
        name: w.name,
        code: w.code,
        totalVariants: 0,
        totalStock: 0,
        stockValue: 0,
      });
    });

    const productValueMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        sku: string;
        totalQuantity: number;
        stockValue: number;
      }
    >();

    stocks.forEach((stock) => {
      const qty = stock.quantity;
      const unitCost = Number(
        stock.productVariant.costPrice || stock.productVariant.price
      );
      const val = qty * unitCost;

      totalStockValue += val;

      if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= stock.reorderPoint) {
        lowStockCount++;
      }

      // Warehouse aggregate
      const whEntry = warehouseMap.get(stock.warehouseId);
      if (whEntry) {
        whEntry.totalVariants += 1;
        whEntry.totalStock += qty;
        whEntry.stockValue += val;
      }

      // Product aggregate
      const prod = stock.productVariant.product;
      let prodEntry = productValueMap.get(prod.id);
      if (!prodEntry) {
        prodEntry = {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          totalQuantity: 0,
          stockValue: 0,
        };
        productValueMap.set(prod.id, prodEntry);
      }
      prodEntry.totalQuantity += qty;
      prodEntry.stockValue += val;
    });

    const stockByWarehouse = Array.from(warehouseMap.values()).map((w) => ({
      ...w,
      stockValue: Number(w.stockValue.toFixed(2)),
    }));

    const topProductsByValue = Array.from(productValueMap.values())
      .map((p) => ({
        ...p,
        stockValue: Number(p.stockValue.toFixed(2)),
      }))
      .sort((a, b) => b.stockValue - a.stockValue)
      .slice(0, 10);

    return {
      totalProducts,
      totalVariants,
      totalStockValue: Number(totalStockValue.toFixed(2)),
      stockByWarehouse,
      lowStockCount,
      outOfStockCount,
      topProductsByValue,
    };
  }

  // ─── 6. CSV Exports ─────────────────────────────────────────────

  async exportSalesCsv(query: SalesReportQuery): Promise<string> {
    const { dateFrom, dateTo, warehouseId } = query;
    const where: Prisma.OrderWhereInput = {
      status: { not: OrderStatus.CANCELLED },
    };

    if (warehouseId) where.warehouseId = warehouseId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        dealer: { select: { name: true, businessName: true } },
        warehouse: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const columns = [
      { header: 'Order Number', key: 'orderNumber' },
      { header: 'Invoice Number', key: 'invoiceNumber' },
      { header: 'Order Date', key: 'orderDate' },
      { header: 'Dealer Name', key: 'dealerName' },
      { header: 'Business Name', key: 'businessName' },
      { header: 'Warehouse', key: 'warehouse' },
      { header: 'Status', key: 'status' },
      { header: 'Subtotal (INR)', key: 'subtotal' },
      { header: 'GST (INR)', key: 'totalGST' },
      { header: 'Grand Total (INR)', key: 'grandTotal' },
    ];

    const data = orders.map((o) => ({
      orderNumber: o.orderNumber,
      invoiceNumber: o.invoiceNumber || '-',
      orderDate: o.createdAt.toISOString().split('T')[0],
      dealerName: o.dealer.name,
      businessName: o.dealer.businessName || o.dealer.name,
      warehouse: `${o.warehouse.name} (${o.warehouse.code})`,
      status: o.status,
      subtotal: Number(o.subtotal).toFixed(2),
      totalGST: Number(o.totalGST).toFixed(2),
      grandTotal: Number(o.grandTotal).toFixed(2),
    }));

    return buildCsv(columns, data);
  }

  async exportDealersCsv(query: DealerReportQuery): Promise<string> {
    const report = await this.getDealerReport(query);

    const columns = [
      { header: 'Dealer Name', key: 'dealerName' },
      { header: 'Business Name', key: 'businessName' },
      { header: 'Total Orders', key: 'totalOrders' },
      { header: 'Total Revenue (INR)', key: 'totalRevenue' },
      { header: 'Avg Order Value (INR)', key: 'avgOrderValue' },
      { header: 'Credit Limit (INR)', key: 'creditLimit' },
      { header: 'Remaining Credit (INR)', key: 'remainingCreditLimit' },
      { header: 'Credit Utilization (%)', key: 'creditUtilization' },
      { header: 'Last Order Date', key: 'lastOrderDate' },
    ];

    const data = report.map((r) => ({
      dealerName: r.dealerName,
      businessName: r.businessName,
      totalOrders: r.totalOrders,
      totalRevenue: r.totalRevenue.toFixed(2),
      avgOrderValue: r.avgOrderValue.toFixed(2),
      creditLimit: r.creditLimit.toFixed(2),
      remainingCreditLimit: r.remainingCreditLimit.toFixed(2),
      creditUtilization: `${r.creditUtilization.toFixed(2)}%`,
      lastOrderDate: r.lastOrderDate ? r.lastOrderDate.toISOString().split('T')[0] : '-',
    }));

    return buildCsv(columns, data);
  }

  async exportInventoryCsv(): Promise<string> {
    const stocks = await prisma.warehouseStock.findMany({
      include: {
        productVariant: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
        warehouse: true,
      },
      orderBy: { warehouse: { code: 'asc' } },
    });

    const columns = [
      { header: 'Warehouse Code', key: 'warehouseCode' },
      { header: 'Warehouse Name', key: 'warehouseName' },
      { header: 'Product Name', key: 'productName' },
      { header: 'Variant Name', key: 'variantName' },
      { header: 'SKU', key: 'sku' },
      { header: 'Category', key: 'category' },
      { header: 'Quantity In Stock', key: 'quantity' },
      { header: 'Reserved Quantity', key: 'reservedQuantity' },
      { header: 'Reorder Point', key: 'reorderPoint' },
      { header: 'Cost Price (INR)', key: 'costPrice' },
      { header: 'Selling Price (INR)', key: 'sellingPrice' },
      { header: 'Stock Value (INR)', key: 'stockValue' },
    ];

    const data = stocks.map((s) => {
      const cost = Number(s.productVariant.costPrice || s.productVariant.price);
      return {
        warehouseCode: s.warehouse.code,
        warehouseName: s.warehouse.name,
        productName: s.productVariant.product.name,
        variantName: s.productVariant.name,
        sku: s.productVariant.sku,
        category: s.productVariant.product.category?.name || '-',
        quantity: s.quantity,
        reservedQuantity: s.reservedQuantity,
        reorderPoint: s.reorderPoint,
        costPrice: Number(s.productVariant.costPrice || 0).toFixed(2),
        sellingPrice: Number(s.productVariant.price).toFixed(2),
        stockValue: (s.quantity * cost).toFixed(2),
      };
    });

    return buildCsv(columns, data);
  }
}

export const reportsService = new ReportsService();
