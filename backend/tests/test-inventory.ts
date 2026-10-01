import app from '../src/app.js';
import { Server } from 'http';
import { prisma } from '../src/common/prisma.js';

let server: Server;
const PORT = 5005;
const BASE_URL = `http://localhost:${PORT}`;

async function runInventoryTests() {
  server = app.listen(PORT, async () => {
    console.log(`🧪 Inventory test server running at ${BASE_URL}`);

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
      if (!adminToken) throw new Error('Admin login failed');

      const dealerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dealer@apexhardware.com', password: 'Dealer@123456' }),
      });
      const dealerLogin: any = await dealerLoginRes.json();
      const dealerToken = dealerLogin.data?.accessToken;
      if (!dealerToken) throw new Error('Dealer login failed');
      console.log('✅ Admin and Dealer tokens acquired');

      // 2. Setup Category, Product & Variant
      console.log('\n--- 2. Setting up Product and Variant for Inventory Tests ---');
      const l1 = await prisma.category.create({
        data: { name: 'Heavy Fasteners', slug: 'heavy-fasteners-test', level: 1 },
      });
      const l2 = await prisma.category.create({
        data: { name: 'M12 Industrial Bolts', slug: 'm12-industrial-bolts-test', level: 2, parentId: l1.id },
      });
      const l3 = await prisma.category.create({
        data: { name: 'High Grade M12 Bolts', slug: 'high-grade-m12-bolts-test', level: 3, parentId: l2.id },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Precision Hex Bolt M12',
          slug: 'precision-hex-bolt-m12-test',
          sku: 'NEX-M12-00001',
          categoryId: l3.id,
          variants: {
            create: {
              name: 'M12 x 80mm Grade 10.9',
              sku: 'NEX-M12-00001-V1',
              price: 200,
              costPrice: 140,
              gstPercentage: 18,
            },
          },
        },
        include: { variants: true },
      });
      const variantId = product.variants[0].id;
      console.log('✅ Created Variant:', product.variants[0].sku, variantId);

      // 3. Create 2 Warehouses via POST /api/warehouses
      console.log('\n--- 3. Create 2 Warehouses via API ---');
      const wh1Res = await fetch(`${BASE_URL}/api/warehouses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          name: 'Delhi North Logistics Hub',
          city: 'Delhi',
          state: 'Delhi',
          address: 'Plot 12, GT Karnal Road',
          pincode: '110033',
        }),
      });
      const wh1Data: any = await wh1Res.json();
      console.log('WH 1 Created:', wh1Res.status, wh1Data.data?.name, `Code: ${wh1Data.data?.code}`);
      if (wh1Res.status !== 201 || !wh1Data.data?.code.startsWith('WH-DEL-')) {
        throw new Error('Warehouse 1 creation failed');
      }
      const wh1Id = wh1Data.data.id;

      const wh2Res = await fetch(`${BASE_URL}/api/warehouses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          name: 'Bengaluru South Distribution Hub',
          city: 'Bengaluru',
          state: 'Karnataka',
          address: 'Electronic City Phase 2',
          pincode: '560100',
        }),
      });
      const wh2Data: any = await wh2Res.json();
      console.log('WH 2 Created:', wh2Res.status, wh2Data.data?.name, `Code: ${wh2Data.data?.code}`);
      if (wh2Res.status !== 201 || !wh2Data.data?.code.startsWith('WH-BEN-')) {
        throw new Error('Warehouse 2 creation failed');
      }
      const wh2Id = wh2Data.data.id;

      // 4. Add Stock via adjust API (POST /api/inventory/adjust)
      console.log('\n--- 4. Inbound Stock Adjustment (100 units to WH 1) ---');
      const adjustRes = await fetch(`${BASE_URL}/api/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          warehouseId: wh1Id,
          productVariantId: variantId,
          quantity: 100,
          type: 'IN',
          notes: 'Initial production batch arrival',
        }),
      });
      const adjustData: any = await adjustRes.json();
      console.log('Adjust Response:', adjustRes.status, `New Quantity: ${adjustData.data?.newQuantity}`);
      if (adjustRes.status !== 200 || adjustData.data?.newQuantity !== 100) {
        throw new Error('Inbound stock adjust failed');
      }

      // 5. Verify Warehouse Summary on Detail
      console.log('\n--- 5. Verify Stock Summary on Warehouse Detail ---');
      const summaryRes = await fetch(`${BASE_URL}/api/warehouses/${wh1Id}/summary`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const summaryData: any = await summaryRes.json();
      console.log('WH 1 Summary:', summaryRes.status, {
        totalVariants: summaryData.data?.totalVariantsStocked,
        totalStock: summaryData.data?.totalPhysicalStock,
        valuation: `₹${summaryData.data?.totalStockValue}`,
      });
      // 100 units * ₹140 cost price = ₹14000
      if (summaryData.data?.totalPhysicalStock !== 100 || summaryData.data?.totalStockValue !== 14000) {
        throw new Error('Warehouse summary valuation mismatch');
      }
      console.log('✅ Stock valuation reconciled exactly with cost price (100 * ₹140 = ₹14,000)');

      // 6. Attempt Transfer Exceeding Available Stock (Expect 400)
      console.log('\n--- 6. Attempt Transfer Exceeding Available Stock (Expect 400) ---');
      const failTransferRes = await fetch(`${BASE_URL}/api/inventory/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          fromWarehouseId: wh1Id,
          toWarehouseId: wh2Id,
          productVariantId: variantId,
          quantity: 150, // Only 100 available!
          notes: 'Attempting excessive transfer',
        }),
      });
      const failTransferData: any = await failTransferRes.json();
      console.log('Excessive Transfer Status:', failTransferRes.status, `Message: ${failTransferData.message}`);
      if (failTransferRes.status !== 400 || !failTransferData.message.includes('Insufficient available stock')) {
        throw new Error('Expected 400 for transfer exceeding available stock');
      }
      console.log('✅ Transfer guard blocked excessive stock transfer');

      // 7. Transfer Stock Atomically (40 units from WH 1 to WH 2)
      console.log('\n--- 7. Transfer 40 Units Atomically from WH 1 to WH 2 ---');
      const transferRes = await fetch(`${BASE_URL}/api/inventory/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          fromWarehouseId: wh1Id,
          toWarehouseId: wh2Id,
          productVariantId: variantId,
          quantity: 40,
          notes: 'Inter-hub replenishment',
        }),
      });
      const transferData: any = await transferRes.json();
      console.log('Transfer Status:', transferRes.status, {
        ref: transferData.data?.transferRef,
        sourceNewQty: transferData.data?.source?.newQuantity,
        destNewQty: transferData.data?.destination?.newQuantity,
      });
      if (
        transferRes.status !== 200 ||
        transferData.data?.source?.newQuantity !== 60 ||
        transferData.data?.destination?.newQuantity !== 40
      ) {
        throw new Error('Atomic transfer quantity update mismatch');
      }
      console.log('✅ Atomic transfer succeeded: WH 1 (60 units) and WH 2 (40 units)');

      // 8. Low Stock Alert Verification
      console.log('\n--- 8. Low Stock Alert Verification ---');
      // Reduce WH 2 stock from 40 to 5 (reorderPoint is 10)
      const reduceRes = await fetch(`${BASE_URL}/api/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          warehouseId: wh2Id,
          productVariantId: variantId,
          quantity: 35,
          type: 'OUT',
          notes: 'Direct offline dispatch',
        }),
      });
      const reduceData: any = await reduceRes.json();
      console.log('WH 2 Reduced Quantity:', reduceData.data?.newQuantity); // Should be 5

      const alertRes = await fetch(`${BASE_URL}/api/inventory/alerts?warehouseId=${wh2Id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const alertData: any = await alertRes.json();
      console.log('Alerts Count:', alertData.data?.length);
      const wh2Alert = alertData.data?.find((a: any) => a.productVariant.id === variantId);
      console.log('Alert Details:', {
        variant: wh2Alert?.productVariant?.sku,
        available: wh2Alert?.availableQuantity,
        reorderPoint: wh2Alert?.reorderPoint,
        severity: wh2Alert?.severity,
      });
      if (!wh2Alert || wh2Alert.availableQuantity !== 5 || wh2Alert.severity !== 'WARNING') {
        throw new Error('Low stock alert verification failed');
      }
      console.log('✅ Low stock alert correctly flagged variant (Available: 5 <= Reorder: 10)');

      // 9. Verify Stock Movement Audit Trail
      console.log('\n--- 9. Verify Stock Movement Audit Trail ---');
      const movRes = await fetch(`${BASE_URL}/api/inventory/movements?productVariantId=${variantId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const movData: any = await movRes.json();
      console.log('Total Movements Recorded:', movData.meta?.total);
      const types = movData.data?.map((m: any) => `${m.type} (${m.quantity}) - ${m.warehouse.code}`);
      console.log('Movement Trail:', types);
      if (movData.meta?.total < 4) {
        throw new Error('Expected at least 4 movement records');
      }
      console.log('✅ All stock movements recorded in immutable audit log');

      // 10. Dealer Warehouse Scoping
      console.log('\n--- 10. Dealer Warehouse Access Scoping ---');
      const dealerWhRes = await fetch(`${BASE_URL}/api/warehouses`, {
        headers: { Authorization: `Bearer ${dealerToken}` },
      });
      const dealerWhData: any = await dealerWhRes.json();
      console.log('Warehouses visible to Dealer:', dealerWhData.data?.length);
      const dealerAssignedOnly = dealerWhData.data?.every(
        (w: any) => w.id === dealerLogin.data?.user?.assignedWarehouseId || w.isPrimary
      );
      if (!dealerAssignedOnly) {
        throw new Error('Dealer should only see assigned or active warehouse');
      }
      console.log('✅ Dealer warehouse access properly restricted');

      // Clean up test data
      console.log('\n--- 11. Cleaning Up Test Data ---');
      await prisma.stockMovement.deleteMany({ where: { productVariantId: variantId } });
      await prisma.warehouseStock.deleteMany({ where: { productVariantId: variantId } });
      await prisma.productVariant.deleteMany({ where: { productId: product.id } });
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.warehouse.delete({ where: { id: wh1Id } });
      await prisma.warehouse.delete({ where: { id: wh2Id } });
      await prisma.category.delete({ where: { id: l3.id } });
      await prisma.category.delete({ where: { id: l2.id } });
      await prisma.category.delete({ where: { id: l1.id } });
      console.log('✅ Test data cleaned up successfully');

      console.log('\n🎉 ALL INVENTORY & WAREHOUSES TESTS PASSED! 🎉\n');
    } catch (err) {
      console.error('\n❌ Test failure:', err);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
      server.close();
    }
  });
}

runInventoryTests();
