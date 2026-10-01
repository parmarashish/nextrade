import app from '../src/app.js';
import { Server } from 'http';
import { prisma } from '../src/common/prisma.js';
import { getIndianFinancialYear, extractWarehouseCodeForInvoice, formatCurrency } from '../src/common/utils.js';
import { OrderStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

let server: Server;
const PORT = 5008;
const BASE_URL = `http://localhost:${PORT}`;

async function runInvoiceTests() {
  server = app.listen(PORT, async () => {
    console.log(`🧪 Invoice test server running at ${BASE_URL}`);

    let cleanupData: {
      categoryId?: string;
      productId?: string;
      warehouseId?: string;
      orderIds: string[];
      dealer2Id?: string;
    } = { orderIds: [] };

    try {
      // 1. Authenticate Admin and Dealer 1
      console.log('\n--- 1. Authenticating Admin & Dealer 1 ---');
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
      console.log('✅ Admin and Dealer 1 tokens acquired');

      // 1b. Create Dealer 2 for authorization tests
      console.log('--- Setting up Dealer 2 for cross-tenant/dealer guards ---');
      const dealer2Email = `dealer2_${Date.now()}@nexdemo.com`;
      const hashedPassword = await bcrypt.hash('Dealer2@123', 10);
      const dealer2 = await prisma.user.create({
        data: {
          email: dealer2Email,
          password: hashedPassword,
          name: 'Bharat Hardware',
          businessName: 'Bharat Hardware Mart',
          phone: '9820098200',
          role: UserRole.DEALER,
          status: 'APPROVED',
          creditLimit: 500000,
          remainingCreditLimit: 500000,
        },
      });
      cleanupData.dealer2Id = dealer2.id;

      const dealer2LoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: dealer2Email, password: 'Dealer2@123' }),
      });
      const dealer2Login: any = await dealer2LoginRes.json();
      const dealer2Token = dealer2Login.data?.accessToken;
      if (!dealer2Token) throw new Error('Dealer 2 login failed: ' + JSON.stringify(dealer2Login));
      console.log('✅ Dealer 2 token acquired');

      // 2. Test Indian FY & Currency Helpers
      console.log('\n--- 2. Testing FY & Currency Formatting Helpers ---');
      const apr26 = new Date('2026-04-01T00:00:00Z');
      const sep26 = new Date('2026-09-18T00:00:00Z');
      const mar27 = new Date('2027-03-31T00:00:00Z');
      const apr27 = new Date('2027-04-01T00:00:00Z');

      const fyApr26 = getIndianFinancialYear(apr26);
      const fySep26 = getIndianFinancialYear(sep26);
      const fyMar27 = getIndianFinancialYear(mar27);
      const fyApr27 = getIndianFinancialYear(apr27);

      console.log(`   Apr 2026 FY: ${fyApr26} (Expected: 2627)`);
      console.log(`   Sep 2026 FY: ${fySep26} (Expected: 2627)`);
      console.log(`   Mar 2027 FY: ${fyMar27} (Expected: 2627)`);
      console.log(`   Apr 2027 FY: ${fyApr27} (Expected: 2728)`);

      if (fyApr26 !== '2627' || fySep26 !== '2627' || fyMar27 !== '2627' || fyApr27 !== '2728') {
        throw new Error('Indian Financial Year calculation failed!');
      }
      console.log('✅ Indian Financial Year calculation verified');

      const whCodeMUM = extractWarehouseCodeForInvoice('WH-MUM-01');
      const whCodeDEL = extractWarehouseCodeForInvoice('WH-DEL-02');
      console.log(`   WH code extract: WH-MUM-01 -> ${whCodeMUM}, WH-DEL-02 -> ${whCodeDEL}`);
      if (whCodeMUM !== 'MUM' || whCodeDEL !== 'DEL') {
        throw new Error('Warehouse code extraction failed!');
      }

      const formattedCur = formatCurrency(123456.78);
      console.log(`   Formatted currency: ${formattedCur} (Expected: ₹1,23,456.78)`);
      if (formattedCur !== '₹1,23,456.78') {
        throw new Error('Indian currency formatting failed!');
      }
      console.log('✅ Indian Rupee currency format verified');

      // 3. Setup Test Warehouse (WH-MUM-01), Catalog & Stock
      console.log('\n--- 3. Setting up Test Warehouse & Inventory ---');
      const whCode = `WH-MUM-${Date.now().toString().slice(-2)}`;
      const warehouse = await prisma.warehouse.create({
        data: {
          name: 'Central Mumbai Distribution Hub',
          code: whCode,
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400013',
          address: 'Plot 10, Lower Parel Industrial Park',
          contactPerson: 'Suresh Patil',
          contactPhone: '9820123456',
        },
      });
      cleanupData.warehouseId = warehouse.id;

      // Assign dealer 1 to this warehouse
      const dealerUser = await prisma.user.findUnique({
        where: { email: 'dealer@apexhardware.com' },
      });
      if (!dealerUser) throw new Error('Dealer 1 not found');

      await prisma.user.update({
        where: { id: dealerUser.id },
        data: {
          assignedWarehouseId: warehouse.id,
          creditLimit: 500000,
          remainingCreditLimit: 500000,
          businessAddress: '42 Apex Plaza, LBS Road, Ghatkopar West, Mumbai, Maharashtra - 400086',
          gstNumber: '27AABCU9603R1ZM',
        },
      });

      const rootCat = await prisma.category.create({
        data: { name: 'Power Tools Root', slug: `pt-root-${Date.now()}`, level: 1 },
      });
      const midCat = await prisma.category.create({
        data: { name: 'Drilling Machinery', slug: `pt-drill-${Date.now()}`, level: 2, parentId: rootCat.id },
      });
      const leafCat = await prisma.category.create({
        data: { name: 'Hammer Drills Industrial', slug: `pt-hdrill-${Date.now()}`, level: 3, parentId: midCat.id },
      });
      cleanupData.categoryId = rootCat.id;

      const product = await prisma.product.create({
        data: {
          name: 'NexTrade Heavy Rotary Hammer 800W',
          slug: `rotary-hammer-${Date.now()}`,
          sku: `NEX-HAM-${Date.now().toString().slice(-5)}`,
          categoryId: leafCat.id,
          variants: {
            create: {
              name: '800W SDS Plus Kit',
              sku: `NEX-HAM-V1-${Date.now().toString().slice(-4)}`,
              price: 4500,
              costPrice: 3200,
              gstPercentage: 18,
            },
          },
        },
        include: { variants: true },
      });
      cleanupData.productId = product.id;
      const variant = product.variants[0];

      // Stock 50 units
      await prisma.warehouseStock.create({
        data: {
          warehouseId: warehouse.id,
          productVariantId: variant.id,
          quantity: 50,
          reservedQuantity: 0,
          reorderPoint: 5,
        },
      });
      console.log('✅ Warehouse & catalog prepared');

      // Helper function to create, confirm, and dispatch an order
      async function createAndDispatchOrder(qty: number, notes: string) {
        await prisma.cartItem.deleteMany({ where: { userId: dealerUser!.id } });
        await fetch(`${BASE_URL}/api/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dealerToken}` },
          body: JSON.stringify({ productVariantId: variant.id, quantity: qty }),
        });

        const checkoutRes = await fetch(`${BASE_URL}/api/orders/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dealerToken}` },
          body: JSON.stringify({
            shippingAddress: {
              name: 'Apex Hardware Delivery Dock',
              phone: '9876543210',
              address: 'Warehouse 3, Apex Terminal',
              city: 'Mumbai',
              state: 'Maharashtra',
              pincode: '400086',
            },
            notes,
          }),
        });
        const checkoutData: any = await checkoutRes.json();
        const order = checkoutData.data;
        cleanupData.orderIds.push(order.id);

        // Confirm order
        await fetch(`${BASE_URL}/api/orders/${order.id}/confirm`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        // Fully dispatch
        const dispatchRes = await fetch(`${BASE_URL}/api/dispatches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({
            orderId: order.id,
            items: [{ orderItemId: order.items[0].id, productVariantId: variant.id, quantity: qty }],
            courierName: 'V-Trans Logistics',
            trackingNumber: `VT-${Date.now().toString().slice(-8)}`,
            notes: 'Dispatch full shipment',
          }),
        });
        const dispatchData: any = await dispatchRes.json();
        return { order, dispatch: dispatchData.data };
      }

      // 4. Place Order 1 and verify Invoice 1 Auto-generation
      console.log('\n--- 4. Order 1: Full Dispatch -> Invoice Auto-generation ---');
      const order1Result = await createAndDispatchOrder(2, 'Order 1 - First Shipment');
      const updatedOrder1 = await prisma.order.findUnique({
        where: { id: order1Result.order.id },
      });

      console.log(`✅ Order 1 Dispatched. Status: ${updatedOrder1?.status}`);
      console.log(`   Allocated Invoice Number: ${updatedOrder1?.invoiceNumber}`);

      const expectedFy = getIndianFinancialYear();
      const expectedWhPrefix = extractWarehouseCodeForInvoice(warehouse.code);
      const expectedInv1 = `INV-${expectedWhPrefix}-${expectedFy}-00001`;

      if (updatedOrder1?.invoiceNumber !== expectedInv1) {
        throw new Error(`Expected invoice number ${expectedInv1}, got ${updatedOrder1?.invoiceNumber}`);
      }
      console.log(`✅ First invoice correctly numbered: ${expectedInv1}`);

      // 5. Place Order 2 and verify Sequential Numbering (00002)
      console.log('\n--- 5. Order 2: Verify Sequential Numbering (00002) ---');
      const order2Result = await createAndDispatchOrder(1, 'Order 2 - Second Shipment');
      const updatedOrder2 = await prisma.order.findUnique({
        where: { id: order2Result.order.id },
      });

      console.log(`✅ Order 2 Dispatched. Status: ${updatedOrder2?.status}`);
      console.log(`   Allocated Invoice Number: ${updatedOrder2?.invoiceNumber}`);

      const expectedInv2 = `INV-${expectedWhPrefix}-${expectedFy}-00002`;
      if (updatedOrder2?.invoiceNumber !== expectedInv2) {
        throw new Error(`Expected sequential invoice number ${expectedInv2}, got ${updatedOrder2?.invoiceNumber}`);
      }
      console.log(`✅ Second invoice sequentially numbered: ${expectedInv2}`);

      // 6. Test PDF Download Endpoints
      console.log('\n--- 6. Testing PDFKit Invoice PDF Generation & Access Control ---');

      // 6a. Dealer 1 downloads own invoice PDF
      const dealerPdfRes = await fetch(`${BASE_URL}/api/invoices/${updatedOrder1!.invoiceNumber}/pdf`, {
        headers: { Authorization: `Bearer ${dealerToken}` },
      });
      console.log(`   Dealer 1 PDF download status: ${dealerPdfRes.status}`);
      const contentType = dealerPdfRes.headers.get('content-type');
      console.log(`   Content-Type: ${contentType}`);
      const pdfBuffer = Buffer.from(await dealerPdfRes.arrayBuffer());
      console.log(`   PDF size: ${pdfBuffer.length} bytes`);

      // Verify PDF header magic bytes "%PDF-"
      const isPdf = pdfBuffer.slice(0, 5).toString() === '%PDF-';
      console.log(`   PDF Magic bytes check: ${isPdf ? 'VALID (%PDF-)' : 'INVALID'}`);

      if (dealerPdfRes.status !== 200 || contentType !== 'application/pdf' || !isPdf) {
        throw new Error('Dealer PDF download failed or did not return valid PDF!');
      }
      console.log('✅ Dealer successfully downloaded their own invoice PDF');

      // 6b. Admin downloads invoice PDF
      const adminPdfRes = await fetch(`${BASE_URL}/api/invoices/${updatedOrder1!.id}/pdf`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log(`   Admin PDF download status: ${adminPdfRes.status}`);
      if (adminPdfRes.status !== 200) {
        throw new Error('Admin could not download invoice PDF!');
      }
      console.log('✅ Admin successfully downloaded invoice PDF');

      // 6c. Dealer 2 attempts to download Dealer 1's invoice PDF (Guards test)
      const unauthorizedPdfRes = await fetch(`${BASE_URL}/api/invoices/${updatedOrder1!.invoiceNumber}/pdf`, {
        headers: { Authorization: `Bearer ${dealer2Token}` },
      });
      console.log(`   Dealer 2 cross-download attempt status: ${unauthorizedPdfRes.status}`);
      if (unauthorizedPdfRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for cross-dealer access, got ${unauthorizedPdfRes.status}`);
      }
      console.log('✅ Cross-dealer invoice download correctly rejected with 403 Forbidden');

      // 7. Test Invoices Listing & Filtering
      console.log('\n--- 7. Testing Invoices Listing & Filters ---');
      const adminListRes = await fetch(`${BASE_URL}/api/invoices?search=${expectedInv1}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const adminListData: any = await adminListRes.json();
      console.log(`   Admin search count: ${adminListData.data.length}`);
      if (adminListData.data.length !== 1 || adminListData.data[0].invoiceNumber !== expectedInv1) {
        throw new Error('Invoice search filter failed!');
      }
      console.log('✅ Invoices search filter working accurately');

      // Dealer list query
      const dealerListRes = await fetch(`${BASE_URL}/api/invoices`, {
        headers: { Authorization: `Bearer ${dealerToken}` },
      });
      const dealerListData: any = await dealerListRes.json();
      console.log(`   Dealer 1 sees: ${dealerListData.data.length} invoice(s)`);
      if (dealerListData.data.length < 2) {
        throw new Error('Dealer list invoices count mismatch!');
      }
      console.log('✅ Dealer invoice listing scoped correctly');

      // 8. Manual Invoice Generation Endpoint (POST /api/invoices/generate/:orderId)
      console.log('\n--- 8. Testing Manual Invoice Generation Endpoint ---');
      // Create a third order, bypass auto-generation by setting status to DISPATCHED manually
      const manualOrder = await prisma.order.create({
        data: {
          orderNumber: `ORD-MANUAL-${Date.now().toString().slice(-4)}`,
          dealerId: dealerUser.id,
          warehouseId: warehouse.id,
          status: OrderStatus.DISPATCHED,
          subtotal: 9000,
          discount: 0,
          totalGST: 1620,
          grandTotal: 10620,
          shippingAddress: {
            name: 'Manual Dock',
            phone: '9876543210',
            address: 'Express Line 5',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400086',
          },
          items: {
            create: {
              productVariantId: variant.id,
              quantity: 2,
              unitPrice: 4500,
              originalUnitPrice: 4500,
              dealerDiscount: 0,
              gstPercentage: 18,
              gstAmount: 1620,
              total: 9000,
            },
          },
        },
      });
      cleanupData.orderIds.push(manualOrder.id);

      const generateRes = await fetch(`${BASE_URL}/api/invoices/generate/${manualOrder.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const generateData: any = await generateRes.json();
      console.log(`   Manual generation result: ${generateData.message}`);
      const expectedInv3 = `INV-${expectedWhPrefix}-${expectedFy}-00003`;
      if (generateData.data.invoiceNumber !== expectedInv3) {
        throw new Error(`Expected manual generation to allocate ${expectedInv3}, got ${generateData.data.invoiceNumber}`);
      }
      console.log(`✅ Manual invoice generation allocated sequential number: ${expectedInv3}`);

      console.log('\n🎉 ALL STEP 9 INVOICES MODULE TESTS PASSED SUCCESSFULLY!');
    } catch (err: any) {
      console.error('\n❌ Invoices test failed:', err);
      process.exitCode = 1;
    } finally {
      console.log('\n🧹 Cleaning up test artifacts...');
      try {
        if (cleanupData.orderIds.length > 0) {
          await prisma.dispatchItem.deleteMany({
            where: { orderItem: { orderId: { in: cleanupData.orderIds } } },
          });
          await prisma.dispatch.deleteMany({
            where: { orderId: { in: cleanupData.orderIds } },
          });
          await prisma.orderItem.deleteMany({
            where: { orderId: { in: cleanupData.orderIds } },
          });
          await prisma.order.deleteMany({
            where: { id: { in: cleanupData.orderIds } },
          });
        }
        if (cleanupData.dealer2Id) {
          await prisma.session.deleteMany({ where: { userId: cleanupData.dealer2Id } });
          await prisma.user.delete({ where: { id: cleanupData.dealer2Id } });
        }
        if (cleanupData.productId) {
          await prisma.warehouseStock.deleteMany({ where: { productVariant: { productId: cleanupData.productId } } });
          await prisma.stockMovement.deleteMany({ where: { productVariant: { productId: cleanupData.productId } } });
          await prisma.productVariant.deleteMany({ where: { productId: cleanupData.productId } });
          await prisma.product.deleteMany({ where: { id: cleanupData.productId } });
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
          await prisma.invoiceSequence.deleteMany({ where: { warehouseId: cleanupData.warehouseId } });
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

runInvoiceTests();
