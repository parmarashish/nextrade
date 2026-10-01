import app from '../src/app.js';
import { Server } from 'http';
import { prisma } from '../src/common/prisma.js';
import { DispatchStatus, OrderStatus, StockMovementType } from '@prisma/client';

let server: Server;
const PORT = 5007;
const BASE_URL = `http://localhost:${PORT}`;

async function runDispatchTests() {
  server = app.listen(PORT, async () => {
    console.log(`🧪 Dispatch test server running at ${BASE_URL}`);

    let cleanupData: {
      categoryId?: string;
      productId?: string;
      warehouseId?: string;
      orderId?: string;
      dispatchIds: string[];
    } = { dispatchIds: [] };

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

      // 2. Setup Test Warehouse, Category, Product, and Stock
      console.log('\n--- 2. Setting up Test Catalog & Inventory ---');
      const whCode = `WH-DSP-${Date.now().toString().slice(-4)}`;
      const warehouse = await prisma.warehouse.create({
        data: {
          name: 'Dispatch Center Mumbai',
          code: whCode,
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          address: 'Gala 4, Industrial Estate',
        },
      });
      cleanupData.warehouseId = warehouse.id;

      // Assign dealer to this warehouse and ensure sufficient credit limit
      const dealerUser = await prisma.user.findUnique({
        where: { email: 'dealer@apexhardware.com' },
      });
      if (!dealerUser) throw new Error('Dealer not found in DB');

      await prisma.user.update({
        where: { id: dealerUser.id },
        data: {
          assignedWarehouseId: warehouse.id,
          creditLimit: 500000,
          remainingCreditLimit: 500000,
        },
      });

      const rootCat = await prisma.category.create({
        data: { name: 'Dispatch Fasteners Root', slug: `dsp-root-${Date.now()}`, level: 1 },
      });
      const midCat = await prisma.category.create({
        data: {
          name: 'Dispatch Industrial Bolts',
          slug: `dsp-mid-${Date.now()}`,
          level: 2,
          parentId: rootCat.id,
        },
      });
      const leafCat = await prisma.category.create({
        data: {
          name: 'Dispatch High Tensile M16',
          slug: `dsp-leaf-${Date.now()}`,
          level: 3,
          parentId: midCat.id,
        },
      });
      cleanupData.categoryId = rootCat.id;

      const product = await prisma.product.create({
        data: {
          name: 'NexTrade M16 Hex Bolt Grade 8.8',
          slug: `dsp-m16-bolt-${Date.now()}`,
          sku: `NEX-DSP-${Date.now().toString().slice(-5)}`,
          categoryId: leafCat.id,
          variants: {
            create: {
              name: 'M16 x 100mm Zinc Plated',
              sku: `NEX-DSP-V1-${Date.now().toString().slice(-4)}`,
              price: 150,
              costPrice: 100,
              gstPercentage: 18,
            },
          },
        },
        include: { variants: true },
      });
      cleanupData.productId = product.id;
      const variant = product.variants[0];

      // Stock 100 units in the warehouse
      await prisma.warehouseStock.create({
        data: {
          warehouseId: warehouse.id,
          productVariantId: variant.id,
          quantity: 100,
          reservedQuantity: 0,
          reorderPoint: 10,
        },
      });
      console.log('✅ Catalog & initial stock (100 units) prepared');

      // 3. Dealer Places Order for 10 units
      console.log('\n--- 3. Dealer Places Order for 10 units ---');
      await prisma.cartItem.deleteMany({ where: { userId: dealerUser.id } });

      const addCartRes = await fetch(`${BASE_URL}/api/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${dealerToken}`,
        },
        body: JSON.stringify({
          productVariantId: variant.id,
          quantity: 10,
        }),
      });
      if (!addCartRes.ok) throw new Error('Failed to add to cart: ' + (await addCartRes.text()));

      const checkoutRes = await fetch(`${BASE_URL}/api/orders/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${dealerToken}`,
        },
        body: JSON.stringify({
          shippingAddress: {
            name: 'Apex Hardware Store',
            phone: '9876543210',
            address: 'Plot 42, Apex Hardware Hub',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400099',
          },
          notes: 'Urgent dispatch required',
        }),
      });
      const checkoutData: any = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error('Checkout failed: ' + JSON.stringify(checkoutData));

      const order = checkoutData.data;
      cleanupData.orderId = order.id;
      console.log(`✅ Order placed: #${order.orderNumber} (Status: ${order.status})`);
      console.log(`   Order Item ID: ${order.items[0].id}, Quantity: ${order.items[0].quantity}`);

      // Verify stock reservation
      const stockAfterCheckout = await prisma.warehouseStock.findUnique({
        where: {
          warehouseId_productVariantId: {
            warehouseId: warehouse.id,
            productVariantId: variant.id,
          },
        },
      });
      console.log(
        `   Warehouse Stock: physical=${stockAfterCheckout?.quantity}, reserved=${stockAfterCheckout?.reservedQuantity}`
      );
      if (stockAfterCheckout?.quantity !== 100 || stockAfterCheckout?.reservedQuantity !== 10) {
        throw new Error('Stock reservation mismatch after checkout!');
      }

      // 4. Test Guards
      console.log('\n--- 4. Testing Dispatch Guards ---');

      // 4a. Dealer cannot create dispatch (Forbidden)
      const dealerDispatchAttempt = await fetch(`${BASE_URL}/api/dispatches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${dealerToken}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          items: [{ orderItemId: order.items[0].id, productVariantId: variant.id, quantity: 5 }],
        }),
      });
      console.log(`   Dealer dispatch attempt status: ${dealerDispatchAttempt.status}`);
      if (dealerDispatchAttempt.status !== 403) {
        throw new Error(`Expected 403 Forbidden for dealer, got ${dealerDispatchAttempt.status}`);
      }
      console.log('✅ Dealer dispatch creation correctly blocked with 403 Forbidden');

      // 4b. Cannot dispatch when order is PENDING
      const pendingDispatchAttempt = await fetch(`${BASE_URL}/api/dispatches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          items: [{ orderItemId: order.items[0].id, productVariantId: variant.id, quantity: 5 }],
        }),
      });
      const pendingDispatchData: any = await pendingDispatchAttempt.json();
      console.log(`   Pending order dispatch attempt: ${pendingDispatchData.message}`);
      if (
        pendingDispatchAttempt.status !== 400 ||
        !pendingDispatchData.message.includes('CONFIRMED or PROCESSING')
      ) {
        throw new Error('Expected 400 Bad Request for dispatching PENDING order');
      }
      console.log('✅ Cannot dispatch PENDING order guard working as expected');

      // 4c. Admin confirms the order
      console.log('   Confirming order as Admin...');
      const confirmRes = await fetch(`${BASE_URL}/api/orders/${order.id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!confirmRes.ok) throw new Error('Order confirmation failed: ' + (await confirmRes.text()));
      console.log('✅ Order confirmed by Admin (Status: CONFIRMED)');

      // 4d. Quantity over remaining undispatched
      const overQuantityAttempt = await fetch(`${BASE_URL}/api/dispatches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          items: [{ orderItemId: order.items[0].id, productVariantId: variant.id, quantity: 15 }],
        }),
      });
      const overQuantityData: any = await overQuantityAttempt.json();
      console.log(`   Over-quantity attempt response: ${overQuantityData.message}`);
      if (overQuantityAttempt.status !== 400 || !overQuantityData.message.includes('remaining to dispatch')) {
        throw new Error('Expected 400 Bad Request for exceeding quantity');
      }
      console.log('✅ Over-quantity dispatch correctly blocked with helpful validation error');

      // 5. Partial Dispatch (4 units of 10)
      console.log('\n--- 5. Partial Dispatch (4 of 10 units) ---');
      const partialDispatchRes = await fetch(`${BASE_URL}/api/dispatches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          items: [{ orderItemId: order.items[0].id, productVariantId: variant.id, quantity: 4 }],
          notes: 'Batch 1 - Partial shipment',
        }),
      });
      const partialDispatchData: any = await partialDispatchRes.json();
      if (!partialDispatchRes.ok) {
        throw new Error('Partial dispatch failed: ' + JSON.stringify(partialDispatchData));
      }

      const dispatch1 = partialDispatchData.data.dispatch;
      cleanupData.dispatchIds.push(dispatch1.id);
      console.log(`✅ Dispatch created: #${dispatch1.dispatchNumber}`);
      console.log(`   Initial status: ${dispatch1.status}`);
      console.log(`   Order new status: ${partialDispatchData.data.orderStatus}`);

      if (partialDispatchData.data.orderStatus !== OrderStatus.PARTIALLY_DISPATCHED) {
        throw new Error(`Expected PARTIALLY_DISPATCHED, got ${partialDispatchData.data.orderStatus}`);
      }

      // Check stock deducted & reservation released
      const stockAfterDsp1 = await prisma.warehouseStock.findUnique({
        where: {
          warehouseId_productVariantId: {
            warehouseId: warehouse.id,
            productVariantId: variant.id,
          },
        },
      });
      console.log(
        `   Stock after DSP 1: physical=${stockAfterDsp1?.quantity} (expected 96), reserved=${stockAfterDsp1?.reservedQuantity} (expected 6)`
      );
      if (stockAfterDsp1?.quantity !== 96 || stockAfterDsp1?.reservedQuantity !== 6) {
        throw new Error('Physical stock deduction or reservation release calculation mismatch!');
      }

      // Check StockMovement record
      const movement1 = await prisma.stockMovement.findFirst({
        where: { referenceId: dispatch1.dispatchNumber },
      });
      console.log(
        `   StockMovement recorded: ${movement1?.type} ${movement1?.quantity} units, ref: ${movement1?.referenceId}`
      );
      if (!movement1 || movement1.type !== StockMovementType.OUT || movement1.quantity !== 4) {
        throw new Error('StockMovement OUT record missing or inaccurate!');
      }

      // 6. Update Tracking Details
      console.log('\n--- 6. Updating Tracking Details for Dispatch 1 ---');
      const trackRes = await fetch(`${BASE_URL}/api/dispatches/${dispatch1.id}/tracking`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          courierName: 'Blue Dart Express',
          trackingNumber: 'BD-MUM-987654321',
          notes: 'Picked up by courier at 3 PM',
        }),
      });
      const trackData: any = await trackRes.json();
      if (!trackRes.ok) throw new Error('Tracking update failed: ' + JSON.stringify(trackData));
      console.log(`✅ Tracking updated: Courier: ${trackData.data.courierName}, AWB: ${trackData.data.trackingNumber}`);
      console.log(`   Dispatch status moved to: ${trackData.data.status}`);
      if (trackData.data.status !== DispatchStatus.IN_TRANSIT) {
        throw new Error(`Expected IN_TRANSIT, got ${trackData.data.status}`);
      }

      // 7. Dealer Views Dispatch List & Detail
      console.log('\n--- 7. Dealer Access to Dispatches ---');
      const dealerListRes = await fetch(`${BASE_URL}/api/dispatches?orderId=${order.id}`, {
        headers: { Authorization: `Bearer ${dealerToken}` },
      });
      const dealerListData: any = await dealerListRes.json();
      console.log(`✅ Dealer sees ${dealerListData.data.length} dispatch(es) for order #${order.orderNumber}`);

      const dealerDetailRes = await fetch(`${BASE_URL}/api/dispatches/${dispatch1.id}`, {
        headers: { Authorization: `Bearer ${dealerToken}` },
      });
      const dealerDetailData: any = await dealerDetailRes.json();
      console.log(`✅ Dealer fetched dispatch #${dealerDetailData.data.dispatchNumber} details with tracking info`);

      // 8. Remaining Dispatch (6 units of 10 -> Full Dispatch)
      console.log('\n--- 8. Complete Remaining Dispatch (6 of 10 units) ---');
      const fullDispatchRes = await fetch(`${BASE_URL}/api/dispatches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          items: [{ orderItemId: order.items[0].id, productVariantId: variant.id, quantity: 6 }],
          courierName: 'Delhivery',
          trackingNumber: 'DEL-9988776655',
          notes: 'Batch 2 - Remaining balance',
        }),
      });
      const fullDispatchData: any = await fullDispatchRes.json();
      if (!fullDispatchRes.ok) throw new Error('Full dispatch failed: ' + JSON.stringify(fullDispatchData));

      const dispatch2 = fullDispatchData.data.dispatch;
      cleanupData.dispatchIds.push(dispatch2.id);
      console.log(`✅ Second dispatch created: #${dispatch2.dispatchNumber}`);
      console.log(`   Order new status: ${fullDispatchData.data.orderStatus}`);
      console.log(`   Is fully dispatched: ${fullDispatchData.data.isFullyDispatched}`);

      if (fullDispatchData.data.orderStatus !== OrderStatus.DISPATCHED) {
        throw new Error(`Expected order status DISPATCHED, got ${fullDispatchData.data.orderStatus}`);
      }

      const stockAfterDsp2 = await prisma.warehouseStock.findUnique({
        where: {
          warehouseId_productVariantId: {
            warehouseId: warehouse.id,
            productVariantId: variant.id,
          },
        },
      });
      console.log(
        `   Stock after DSP 2: physical=${stockAfterDsp2?.quantity} (expected 90), reserved=${stockAfterDsp2?.reservedQuantity} (expected 0)`
      );
      if (stockAfterDsp2?.quantity !== 90 || stockAfterDsp2?.reservedQuantity !== 0) {
        throw new Error('Stock balance calculation mismatch after full dispatch!');
      }

      // 9. Delivery Workflow
      console.log('\n--- 9. Delivery Workflow ---');
      // Deliver dispatch 1
      const deliver1Res = await fetch(`${BASE_URL}/api/dispatches/${dispatch1.id}/deliver`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const deliver1Data: any = await deliver1Res.json();
      console.log(`✅ Dispatch 1 marked as delivered. Order fully delivered? ${deliver1Data.orderDelivered}`);
      if (deliver1Data.orderDelivered !== false) {
        throw new Error('Order should NOT be marked delivered while dispatch 2 is in transit!');
      }

      // Deliver dispatch 2
      const deliver2Res = await fetch(`${BASE_URL}/api/dispatches/${dispatch2.id}/deliver`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const deliver2Data: any = await deliver2Res.json();
      console.log(`✅ Dispatch 2 marked as delivered. Order fully delivered? ${deliver2Data.orderDelivered}`);
      if (deliver2Data.orderDelivered !== true) {
        throw new Error('Order SHOULD be marked delivered once all dispatches are delivered!');
      }

      const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
      console.log(`   Final Order Status: ${finalOrder?.status}`);
      if (finalOrder?.status !== OrderStatus.DELIVERED) {
        throw new Error(`Expected order status DELIVERED, got ${finalOrder?.status}`);
      }

      console.log('\n🎉 ALL STEP 8 DISPATCH TESTS PASSED SUCCESSFULLY!');
    } catch (err: any) {
      console.error('\n❌ Dispatch test failed:', err);
      process.exitCode = 1;
    } finally {
      // Clean up test data
      console.log('\n🧹 Cleaning up test artifacts...');
      try {
        if (cleanupData.dispatchIds.length > 0) {
          await prisma.dispatchItem.deleteMany({
            where: { dispatchId: { in: cleanupData.dispatchIds } },
          });
          await prisma.dispatch.deleteMany({
            where: { id: { in: cleanupData.dispatchIds } },
          });
        }
        if (cleanupData.orderId) {
          await prisma.orderItem.deleteMany({ where: { orderId: cleanupData.orderId } });
          await prisma.order.deleteMany({ where: { id: cleanupData.orderId } });
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

runDispatchTests();
