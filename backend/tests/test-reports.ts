import app from '../src/app.js';
import { Server } from 'http';
import { prisma } from '../src/common/prisma.js';
import { OrderStatus, UserRole } from '@prisma/client';

let server: Server;
const PORT = 5009;
const BASE_URL = `http://localhost:${PORT}`;

async function runReportTests() {
  server = app.listen(PORT, async () => {
    console.log(`🧪 Reports test server running at ${BASE_URL}`);

    let cleanupData: {
      categoryId?: string;
      productIds: string[];
      warehouseId?: string;
      orderIds: string[];
    } = { productIds: [], orderIds: [] };

    try {
      // 1. Authenticate Admin and Dealer
      console.log('\n--- 1. Authenticating Admin & Dealer ---');
      const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@nextrade.com', password: 'Admin@123456' }),
      });
      const adminLogin: any = await adminLoginRes.json();
      const adminToken = adminLogin.data?.accessToken;
      if (!adminToken) throw new Error('Admin login failed: ' + JSON.stringify(adminLogin));

      const dealerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dealer@apexhardware.com', password: 'Dealer@123456' }),
      });
      const dealerLogin: any = await dealerLoginRes.json();
      const dealerToken = dealerLogin.data?.accessToken;
      if (!dealerToken) throw new Error('Dealer login failed: ' + JSON.stringify(dealerLogin));
      console.log('✅ Admin and Dealer tokens acquired');

      // 1b. Role Guard Test: Dealer cannot access reports
      console.log('--- Testing Role Guards (Dealer should get 403) ---');
      const dealerAttempt = await fetch(`${BASE_URL}/api/reports/summary`, {
        headers: { Authorization: `Bearer ${dealerToken}` },
      });
      console.log(`   Dealer access to /api/reports/summary: ${dealerAttempt.status}`);
      if (dealerAttempt.status !== 403) {
        throw new Error(`Expected 403 Forbidden for dealer, got ${dealerAttempt.status}`);
      }
      console.log('✅ Dealer access correctly rejected with 403 Forbidden');

      // 2. Setup Test Data (Warehouse, 2 Leaf Categories, Products, Stocks, Orders)
      console.log('\n--- 2. Setting up Test Data for Reporting ---');
      const whCode = `WH-REP-${Date.now().toString().slice(-4)}`;
      const warehouse = await prisma.warehouse.create({
        data: {
          name: 'Reports Testing Warehouse',
          code: whCode,
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411001',
          address: 'Plot 88, Hinjawadi Phase 1',
        },
      });
      cleanupData.warehouseId = warehouse.id;

      const dealerUser = await prisma.user.findUnique({
        where: { email: 'dealer@apexhardware.com' },
      });
      if (!dealerUser) throw new Error('Dealer not found');

      // Set credit limit: 100,000, remaining: 60,000 -> 40% utilization
      await prisma.user.update({
        where: { id: dealerUser.id },
        data: {
          creditLimit: 100000,
          remainingCreditLimit: 60000,
          assignedWarehouseId: warehouse.id,
        },
      });

      // Category Hierarchy: Root -> Mid -> Leaf A & Leaf B
      const rootCat = await prisma.category.create({
        data: { name: 'Abrasives & Cutting', slug: `rep-root-${Date.now()}`, level: 1 },
      });
      const midCat = await prisma.category.create({
        data: { name: 'Cutting Wheels', slug: `rep-mid-${Date.now()}`, level: 2, parentId: rootCat.id },
      });
      const leafCatA = await prisma.category.create({
        data: { name: 'Metal Cut-Off Wheels', slug: `rep-leafa-${Date.now()}`, level: 3, parentId: midCat.id },
      });
      const leafCatB = await prisma.category.create({
        data: { name: 'Diamond Saw Blades', slug: `rep-leafb-${Date.now()}`, level: 3, parentId: midCat.id },
      });
      cleanupData.categoryId = rootCat.id;

      // Product A (under Leaf A)
      const prodA = await prisma.product.create({
        data: {
          name: 'Inox 4-Inch Thin Cutting Disc',
          slug: `prod-a-${Date.now()}`,
          sku: `NEX-REP-A-${Date.now().toString().slice(-4)}`,
          categoryId: leafCatA.id,
          variants: {
            create: {
              name: '100 x 1.0mm Thin Wheel',
              sku: `NEX-REP-A1-${Date.now().toString().slice(-4)}`,
              price: 50,
              costPrice: 30,
              gstPercentage: 18,
            },
          },
        },
        include: { variants: true },
      });
      cleanupData.productIds.push(prodA.id);
      const varA = prodA.variants[0];

      // Product B (under Leaf B)
      const prodB = await prisma.product.create({
        data: {
          name: 'Segmented Diamond Blade 110mm',
          slug: `prod-b-${Date.now()}`,
          sku: `NEX-REP-B-${Date.now().toString().slice(-4)}`,
          categoryId: leafCatB.id,
          variants: {
            create: {
              name: '110mm Turbo Rim',
              sku: `NEX-REP-B1-${Date.now().toString().slice(-4)}`,
              price: 250,
              costPrice: 150,
              gstPercentage: 18,
            },
          },
        },
        include: { variants: true },
      });
      cleanupData.productIds.push(prodB.id);
      const varB = prodB.variants[0];

      // Stock: Var A has 100 units (cost 30), Var B has 5 units (low stock alert, cost 150)
      await prisma.warehouseStock.createMany({
        data: [
          {
            warehouseId: warehouse.id,
            productVariantId: varA.id,
            quantity: 100,
            reservedQuantity: 0,
            reorderPoint: 20,
          },
          {
            warehouseId: warehouse.id,
            productVariantId: varB.id,
            quantity: 5,
            reservedQuantity: 0,
            reorderPoint: 10,
          },
        ],
      });
      console.log('✅ Catalog and warehouse stocks prepared');

      // Orders:
      // Order 1: Delivered this month -> 10 units of Var A (subtotal 500, GST 90, GrandTotal 590)
      const now = new Date();
      const order1 = await prisma.order.create({
        data: {
          orderNumber: `ORD-REP-1-${Date.now().toString().slice(-4)}`,
          dealerId: dealerUser.id,
          warehouseId: warehouse.id,
          status: OrderStatus.DELIVERED,
          subtotal: 500,
          discount: 0,
          totalGST: 90,
          grandTotal: 590,
          createdAt: now,
          shippingAddress: { name: 'Apex Site', phone: '9820012345', address: 'Plot 1', city: 'Pune', state: 'MH', pincode: '411001' },
          items: {
            create: {
              productVariantId: varA.id,
              quantity: 10,
              unitPrice: 50,
              originalUnitPrice: 50,
              dealerDiscount: 0,
              gstPercentage: 18,
              gstAmount: 90,
              total: 500,
            },
          },
        },
      });
      cleanupData.orderIds.push(order1.id);

      // Order 2: Delivered last month -> 4 units of Var B (subtotal 1000, GST 180, GrandTotal 1180)
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0);
      const order2 = await prisma.order.create({
        data: {
          orderNumber: `ORD-REP-2-${Date.now().toString().slice(-4)}`,
          dealerId: dealerUser.id,
          warehouseId: warehouse.id,
          status: OrderStatus.DELIVERED,
          subtotal: 1000,
          discount: 0,
          totalGST: 180,
          grandTotal: 1180,
          createdAt: lastMonthDate,
          shippingAddress: { name: 'Apex Site', phone: '9820012345', address: 'Plot 1', city: 'Pune', state: 'MH', pincode: '411001' },
          items: {
            create: {
              productVariantId: varB.id,
              quantity: 4,
              unitPrice: 250,
              originalUnitPrice: 250,
              dealerDiscount: 0,
              gstPercentage: 18,
              gstAmount: 180,
              total: 1000,
            },
          },
        },
      });
      cleanupData.orderIds.push(order2.id);

      // Order 3: Pending this month -> 2 units of Var A (GrandTotal 118)
      const order3 = await prisma.order.create({
        data: {
          orderNumber: `ORD-REP-3-${Date.now().toString().slice(-4)}`,
          dealerId: dealerUser.id,
          warehouseId: warehouse.id,
          status: OrderStatus.PENDING,
          subtotal: 100,
          discount: 0,
          totalGST: 18,
          grandTotal: 118,
          createdAt: now,
          shippingAddress: { name: 'Apex Site', phone: '9820012345', address: 'Plot 1', city: 'Pune', state: 'MH', pincode: '411001' },
          items: {
            create: {
              productVariantId: varA.id,
              quantity: 2,
              unitPrice: 50,
              originalUnitPrice: 50,
              dealerDiscount: 0,
              gstPercentage: 18,
              gstAmount: 18,
              total: 100,
            },
          },
        },
      });
      cleanupData.orderIds.push(order3.id);
      console.log('✅ Orders prepared (This Month Delivered, Last Month Delivered, Pending)');

      // 3. Test Dashboard Summary KPIs
      console.log('\n--- 3. Testing Dashboard Summary KPIs ---');
      const summaryRes = await fetch(`${BASE_URL}/api/reports/summary`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const summaryData: any = await summaryRes.json();
      console.log('   Summary response:', summaryData.data);

      if (!summaryRes.ok || !summaryData.success) {
        throw new Error('Failed to get summary: ' + JSON.stringify(summaryData));
      }

      const s = summaryData.data;
      if (typeof s.totalRevenue !== 'number' || typeof s.revenueChange !== 'number' || typeof s.ordersChange !== 'number') {
        throw new Error('Summary KPI types invalid');
      }
      console.log(`   Total Revenue this month: ₹${s.totalRevenue}`);
      console.log(`   Revenue Change vs last month: ${s.revenueChange}%`);
      console.log(`   Pending Orders count: ${s.pendingOrders}`);
      console.log(`   Low Stock Alerts: ${s.lowStockAlerts}`);
      console.log('✅ Dashboard Summary KPIs validated successfully');

      // 4. Test Sales Report
      console.log('\n--- 4. Testing Sales Report ---');
      const salesRes = await fetch(`${BASE_URL}/api/reports/sales?warehouseId=${warehouse.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const salesData: any = await salesRes.json();
      console.log('   Sales report data:', {
        totalRevenue: salesData.data.totalRevenue,
        totalOrders: salesData.data.totalOrders,
        avgOrderValue: salesData.data.avgOrderValue,
        monthsCount: salesData.data.revenueByMonth.length,
        statusBreakdown: salesData.data.revenueByStatus.length,
      });

      if (!salesRes.ok || salesData.data.totalOrders !== 3) {
        throw new Error(`Expected 3 total orders for warehouse, got ${salesData.data?.totalOrders}`);
      }
      // Total delivered revenue = Order 1 (590) + Order 2 (1180) = 1770
      if (salesData.data.totalRevenue !== 1770) {
        throw new Error(`Expected total revenue 1770, got ${salesData.data.totalRevenue}`);
      }
      // Avg order value = 1770 / 2 delivered orders = 885
      if (salesData.data.avgOrderValue !== 885) {
        throw new Error(`Expected avg order value 885, got ${salesData.data.avgOrderValue}`);
      }
      // Verify monthly chart array has 12 months
      if (salesData.data.revenueByMonth.length !== 12) {
        throw new Error('Expected 12 monthly bars');
      }
      console.log('✅ Sales report metrics & 12-month breakdown verified');

      // 5. Test Categories Report
      console.log('\n--- 5. Testing Categories Report ---');
      const catRes = await fetch(`${BASE_URL}/api/reports/categories`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const catData: any = await catRes.json();
      console.log('   Top categories found:', catData.data.length);

      const foundLeafA = catData.data.find((c: any) => c.categoryId === leafCatA.id);
      const foundLeafB = catData.data.find((c: any) => c.categoryId === leafCatB.id);

      console.log(`   Leaf A (${leafCatA.name}): Revenue ₹${foundLeafA?.totalRevenue}, Units ${foundLeafA?.totalUnits}`);
      console.log(`   Leaf B (${leafCatB.name}): Revenue ₹${foundLeafB?.totalRevenue}, Units ${foundLeafB?.totalUnits}`);

      if (!foundLeafA || !foundLeafB) {
        throw new Error('Expected categories not found in report!');
      }
      // Leaf A: Order 1 (10 units = 590) + Order 3 (2 units = 118) = 708
      if (foundLeafA.totalRevenue !== 708 || foundLeafA.totalUnits !== 12) {
        throw new Error(`Category Leaf A revenue/units mismatch: got revenue ${foundLeafA.totalRevenue}, units ${foundLeafA.totalUnits}`);
      }
      // Leaf B: Order 2 (4 units = 1180)
      if (foundLeafB.totalRevenue !== 1180 || foundLeafB.totalUnits !== 4) {
        throw new Error(`Category Leaf B revenue/units mismatch: got revenue ${foundLeafB.totalRevenue}, units ${foundLeafB.totalUnits}`);
      }
      console.log('✅ Categories report verified with leaf level scoping');

      // 6. Test Dealers Report
      console.log('\n--- 6. Testing Dealers Report ---');
      const dealerReportRes = await fetch(`${BASE_URL}/api/reports/dealers`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const dealerReportData: any = await dealerReportRes.json();
      const dealerStats = dealerReportData.data.find((d: any) => d.dealerId === dealerUser.id);

      console.log('   Dealer stats:', {
        name: dealerStats?.dealerName,
        totalOrders: dealerStats?.totalOrders,
        totalRevenue: dealerStats?.totalRevenue,
        creditLimit: dealerStats?.creditLimit,
        remainingCredit: dealerStats?.remainingCreditLimit,
        creditUtilization: `${dealerStats?.creditUtilization}%`,
      });

      if (!dealerStats || dealerStats.creditUtilization !== 40) {
        throw new Error(`Expected 40% credit utilization, got ${dealerStats?.creditUtilization}`);
      }
      console.log('✅ Dealer report and credit utilization verified');

      // 7. Test Inventory Report
      console.log('\n--- 7. Testing Inventory Report ---');
      const invReportRes = await fetch(`${BASE_URL}/api/reports/inventory`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const invReportData: any = await invReportRes.json();
      const inv = invReportData.data;

      console.log('   Inventory report:', {
        totalProducts: inv.totalProducts,
        totalVariants: inv.totalVariants,
        totalStockValue: `₹${inv.totalStockValue}`,
        lowStockCount: inv.lowStockCount,
        warehouses: inv.stockByWarehouse.length,
      });

      const whStock = inv.stockByWarehouse.find((w: any) => w.warehouseId === warehouse.id);
      // Expected stock value in this warehouse:
      // Var A: 100 * cost 30 = 3000
      // Var B: 5 * cost 150 = 750
      // Total = 3750
      console.log(`   WH ${warehouse.code} Stock Value: ₹${whStock?.stockValue} (Expected: ₹3750.00)`);
      if (whStock?.stockValue !== 3750) {
        throw new Error(`Expected warehouse stock value 3750, got ${whStock?.stockValue}`);
      }
      console.log('✅ Inventory stock valuation verified');

      // 8. Test CSV Exports
      console.log('\n--- 8. Testing CSV Exports ---');

      // 8a. Sales CSV
      const salesCsvRes = await fetch(`${BASE_URL}/api/reports/sales/export`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const salesBuf = Buffer.from(await salesCsvRes.arrayBuffer());
      const salesCsvType = salesCsvRes.headers.get('content-type');
      console.log(`   Sales CSV status: ${salesCsvRes.status}, Content-Type: ${salesCsvType}`);
      const salesHasBOM = salesBuf[0] === 0xef && salesBuf[1] === 0xbb && salesBuf[2] === 0xbf;
      console.log(`   Sales CSV UTF-8 BOM bytes (0xEF, 0xBB, 0xBF): ${salesHasBOM ? 'VALID' : 'INVALID'}`);
      const salesCsvText = salesBuf.toString('utf-8');
      if (!salesCsvType?.includes('text/csv') || !salesHasBOM || !salesCsvText.includes('Order Number')) {
        throw new Error('Sales CSV export invalid format!');
      }

      // 8b. Dealers CSV
      const dealersCsvRes = await fetch(`${BASE_URL}/api/reports/dealers/export`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const dealersCsvText = await dealersCsvRes.text();
      const dealersCsvType = dealersCsvRes.headers.get('content-type');
      console.log(`   Dealers CSV status: ${dealersCsvRes.status}, Content-Type: ${dealersCsvType}`);
      if (!dealersCsvType?.includes('text/csv') || !dealersCsvText.includes('Credit Utilization (%)')) {
        throw new Error('Dealers CSV export invalid format!');
      }

      // 8c. Inventory CSV
      const invCsvRes = await fetch(`${BASE_URL}/api/reports/inventory/export`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const invCsvText = await invCsvRes.text();
      const invCsvType = invCsvRes.headers.get('content-type');
      console.log(`   Inventory CSV status: ${invCsvRes.status}, Content-Type: ${invCsvType}`);
      if (!invCsvType?.includes('text/csv') || !invCsvText.includes('Stock Value (INR)')) {
        throw new Error('Inventory CSV export invalid format!');
      }
      console.log('✅ All CSV exports verified with valid headers and UTF-8 BOM');

      console.log('\n🎉 ALL STEP 10 REPORTS MODULE TESTS PASSED SUCCESSFULLY!');
    } catch (err: any) {
      console.error('\n❌ Reports test failed:', err);
      process.exitCode = 1;
    } finally {
      console.log('\n🧹 Cleaning up test artifacts...');
      try {
        if (cleanupData.orderIds.length > 0) {
          await prisma.orderItem.deleteMany({
            where: { orderId: { in: cleanupData.orderIds } },
          });
          await prisma.order.deleteMany({
            where: { id: { in: cleanupData.orderIds } },
          });
        }
        if (cleanupData.productIds.length > 0) {
          await prisma.warehouseStock.deleteMany({
            where: { productVariant: { productId: { in: cleanupData.productIds } } },
          });
          await prisma.productVariant.deleteMany({
            where: { productId: { in: cleanupData.productIds } },
          });
          await prisma.product.deleteMany({
            where: { id: { in: cleanupData.productIds } },
          });
        }
        if (cleanupData.categoryId) {
          await prisma.category.deleteMany({
            where: {
              OR: [
                { id: cleanupData.categoryId },
                { parent: { id: cleanupData.categoryId } },
                { parent: { parentId: cleanupData.categoryId } },
              ],
            },
          });
        }
        if (cleanupData.warehouseId) {
          await prisma.user.updateMany({
            where: { assignedWarehouseId: cleanupData.warehouseId },
            data: { assignedWarehouseId: null },
          });
          await prisma.warehouse.deleteMany({ where: { id: cleanupData.warehouseId } });
        }
        console.log('🧹 Cleanup complete');
      } catch (cleanupErr) {
        console.warn('⚠️ Cleanup error:', cleanupErr);
      }

      server.close();
      await prisma.$disconnect();
    }
  });
}

runReportTests();
