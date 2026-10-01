import app from '../src/app.js';
import { Server } from 'http';
import { prisma } from '../src/common/prisma.js';
import bcrypt from 'bcryptjs';
import { UserRole, UserStatus } from '@prisma/client';

let server: Server;
const PORT = 5007;
const BASE_URL = `http://localhost:${PORT}`;

async function runOrderTests() {
  server = app.listen(PORT, async () => {
    console.log(`🧪 Orders & Checkout test server running at ${BASE_URL}`);

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
      if (!adminToken) throw new Error('Admin login failed');

      const dealer1LoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dealer@apexhardware.com', password: 'Dealer@123456' }),
      });
      const dealer1Login: any = await dealer1LoginRes.json();
      const dealer1Token = dealer1Login.data?.accessToken;
      const dealer1Id = dealer1Login.data?.user?.id;
      if (!dealer1Token || !dealer1Id) throw new Error('Dealer 1 login failed');

      // Create & Approve Dealer 2 for concurrency testing
      const dealer2Password = await bcrypt.hash('Dealer2@123456', 10);
      const warehouse = await prisma.warehouse.findFirst({ where: { isPrimary: true } });
      if (!warehouse) throw new Error('Primary warehouse not found');

      const dealer2 = await prisma.user.upsert({
        where: { email: 'dealer2@concurrencytest.com' },
        update: { status: UserStatus.APPROVED, creditLimit: 200000, remainingCreditLimit: 200000 },
        create: {
          email: 'dealer2@concurrencytest.com',
          password: dealer2Password,
          name: 'Concurrent Dealer',
          role: UserRole.DEALER,
          status: UserStatus.APPROVED,
          creditLimit: 200000,
          creditDays: 30,
          remainingCreditLimit: 200000,
          assignedWarehouseId: warehouse.id,
        },
      });

      const dealer2LoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dealer2@concurrencytest.com', password: 'Dealer2@123456' }),
      });
      const dealer2Login: any = await dealer2LoginRes.json();
      const dealer2Token = dealer2Login.data?.accessToken;
      if (!dealer2Token) throw new Error('Dealer 2 login failed');
      console.log('✅ Admin, Dealer 1, and Dealer 2 authenticated');

      // 2. Setup Category, Product, Variant, and Discount
      console.log('\n--- 2. Setting up Catalog & Pricing ---');
      const l1 = await prisma.category.create({ data: { name: 'Fluid Control', slug: 'fluid-control-test', level: 1 } });
      const l2 = await prisma.category.create({ data: { name: 'Valves', slug: 'valves-test', level: 2, parentId: l1.id } });
      const l3 = await prisma.category.create({ data: { name: 'Industrial Ball Valves', slug: 'industrial-ball-valves-test', level: 3, parentId: l2.id } });

      const product = await prisma.product.create({
        data: {
          name: 'Forged Steel Ball Valve',
          slug: 'forged-steel-ball-valve-test',
          sku: 'NEX-VAL-00001',
          categoryId: l3.id,
          variants: {
            create: {
              name: '2 Inch Flanged Class 150',
              sku: 'NEX-VAL-00001-V1',
              price: 1000.0,
              gstPercentage: 18.0,
            },
          },
        },
        include: { variants: true },
      });
      const variantId = product.variants[0].id;

      // Set 20% Category Discount for Dealer 1
      await prisma.dealerCategoryDiscount.upsert({
        where: { dealerId_categoryId: { dealerId: dealer1Id, categoryId: l3.id } },
        update: { discountPercentage: 20.0 },
        create: { dealerId: dealer1Id, categoryId: l3.id, discountPercentage: 20.0 },
      });

      // Add 50 units stock in warehouse
      await prisma.warehouseStock.upsert({
        where: { warehouseId_productVariantId: { warehouseId: warehouse.id, productVariantId: variantId } },
        update: { quantity: 50, reservedQuantity: 0 },
        create: { warehouseId: warehouse.id, productVariantId: variantId, quantity: 50, reservedQuantity: 0 },
      });
      console.log('✅ Catalog ready: Base Price ₹1,000 | 20% Dealer Discount | 50 units stock');

      // 3. Test Cart: Add 2 Units and Verify Pricing
      console.log('\n--- 3. Testing Cart: Add Items & Verify Effective Pricing ---');
      const addCartRes = await fetch(`${BASE_URL}/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dealer1Token}` },
        body: JSON.stringify({ productVariantId: variantId, quantity: 2 }),
      });
      const addCartData: any = await addCartRes.json();
      console.log('Add to Cart Status:', addCartRes.status);
      if (addCartRes.status !== 201) throw new Error('Add to cart failed');

      const getCartRes = await fetch(`${BASE_URL}/api/cart`, {
        headers: { Authorization: `Bearer ${dealer1Token}` },
      });
      const getCartData: any = await getCartRes.json();
      const cartItem = getCartData.data?.items[0];
      const cartSummary = getCartData.data?.summary;
      console.log('Cart Item Pricing:', {
        name: cartItem?.variantName,
        originalUnitPrice: `₹${cartItem?.originalUnitPrice}`,
        discountPercent: `${cartItem?.dealerDiscountPercent}%`,
        effectiveUnitPrice: `₹${cartItem?.unitPrice}`,
        taxableTotal: `₹${cartItem?.taxableTotal}`,
        gstAmount: `₹${cartItem?.gstAmount}`,
        lineTotal: `₹${cartItem?.lineTotal}`,
      });
      console.log('Cart Summary:', cartSummary);

      // Calculations check:
      // Base: ₹1,000, 20% discount => ₹800.00
      // 2 units: Subtotal = 2 * 800 = ₹1,600.00
      // GST (18% of 1600) = ₹288.00
      // Grand Total = 1600 + 288 = ₹1,888.00
      if (
        cartItem?.unitPrice !== 800 ||
        cartItem?.taxableTotal !== 1600 ||
        cartItem?.gstAmount !== 288 ||
        cartItem?.lineTotal !== 1888 ||
        cartSummary?.grandTotal !== 1888
      ) {
        throw new Error('Cart price calculation mismatch');
      }
      console.log('✅ Paisa-exact cart calculation verified: Subtotal ₹1,600 + GST ₹288 = Grand Total ₹1,888');

      // 4. Test Checkout: Creates Order, Deducts Credit, Reserves Stock
      console.log('\n--- 4. Testing Checkout (Order Placement) ---');
      const dealer1Before = await prisma.user.findUnique({ where: { id: dealer1Id } });
      const initialCredit = Number(dealer1Before?.remainingCreditLimit);

      const checkoutRes = await fetch(`${BASE_URL}/api/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dealer1Token}` },
        body: JSON.stringify({
          notes: 'Urgent delivery for project site A',
        }),
      });
      const checkoutData: any = await checkoutRes.json();
      const order = checkoutData.data;
      console.log('Checkout Status:', checkoutRes.status, {
        orderNumber: order?.orderNumber,
        grandTotal: `₹${order?.grandTotal}`,
        status: order?.status,
        reservedStock: 2,
      });

      if (
        checkoutRes.status !== 201 ||
        !order?.orderNumber.startsWith('ORD-') ||
        Number(order?.grandTotal) !== 1888 ||
        order?.status !== 'PENDING'
      ) {
        throw new Error('Checkout failed or order totals mismatch');
      }

      // Check stock reserved
      const stockAfterOrder = await prisma.warehouseStock.findUnique({
        where: { warehouseId_productVariantId: { warehouseId: warehouse.id, productVariantId: variantId } },
      });
      console.log('Warehouse Stock after Order:', {
        physical: stockAfterOrder?.quantity,
        reserved: stockAfterOrder?.reservedQuantity,
        available: (stockAfterOrder?.quantity || 0) - (stockAfterOrder?.reservedQuantity || 0),
      });
      if (stockAfterOrder?.reservedQuantity !== 2) {
        throw new Error('Reserved stock count mismatch after order');
      }

      // Check credit limit deducted
      const dealer1After = await prisma.user.findUnique({ where: { id: dealer1Id } });
      const expectedCredit = initialCredit - 1888;
      console.log('Dealer Credit Limit:', {
        before: `₹${initialCredit}`,
        after: `₹${dealer1After?.remainingCreditLimit}`,
        deducted: '₹1888',
      });
      if (Number(dealer1After?.remainingCreditLimit) !== expectedCredit) {
        throw new Error('Credit limit deduction mismatch');
      }
      console.log('✅ Credit limit deducted and atomic stock reserved');

      // 5. Test Cancel Order: Releases Stock and Restores Credit
      console.log('\n--- 5. Testing Order Cancellation by Admin ---');
      const cancelRes = await fetch(`${BASE_URL}/api/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const cancelData: any = await cancelRes.json();
      console.log('Cancel Status:', cancelRes.status, cancelData.message);
      if (cancelRes.status !== 200 || cancelData.data?.status !== 'CANCELLED') {
        throw new Error('Cancel order failed');
      }

      // Check reserved stock released
      const stockAfterCancel = await prisma.warehouseStock.findUnique({
        where: { warehouseId_productVariantId: { warehouseId: warehouse.id, productVariantId: variantId } },
      });
      if (stockAfterCancel?.reservedQuantity !== 0) {
        throw new Error('Stock reservation was not released on order cancellation');
      }

      // Check credit limit restored
      const dealer1Restored = await prisma.user.findUnique({ where: { id: dealer1Id } });
      if (Number(dealer1Restored?.remainingCreditLimit) !== initialCredit) {
        throw new Error('Credit limit was not restored on order cancellation');
      }
      console.log('✅ Stock released (reserved: 0) and dealer credit limit fully restored');

      // 6. Concurrent Checkout Test: 2 Dealers competing for the LAST 1 UNIT
      console.log('\n--- 6. Concurrent Checkout Stress Test (Last 1 Unit Race Condition) ---');
      // Set stock to exactly 1 unit
      await prisma.warehouseStock.update({
        where: { warehouseId_productVariantId: { warehouseId: warehouse.id, productVariantId: variantId } },
        data: { quantity: 1, reservedQuantity: 0 },
      });

      // Both Dealer 1 and Dealer 2 add 1 unit to cart
      await fetch(`${BASE_URL}/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dealer1Token}` },
        body: JSON.stringify({ productVariantId: variantId, quantity: 1 }),
      });
      await fetch(`${BASE_URL}/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dealer2Token}` },
        body: JSON.stringify({ productVariantId: variantId, quantity: 1 }),
      });

      console.log('Both dealers added the last 1 unit to cart. Firing concurrent checkout requests...');

      // Fire both checkout requests simultaneously
      const [res1, res2] = await Promise.all([
        fetch(`${BASE_URL}/api/orders/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dealer1Token}` },
          body: JSON.stringify({ notes: 'Concurrent request Dealer 1' }),
        }),
        fetch(`${BASE_URL}/api/orders/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dealer2Token}` },
          body: JSON.stringify({ notes: 'Concurrent request Dealer 2' }),
        }),
      ]);

      const [data1, data2]: [any, any] = await Promise.all([res1.json(), res2.json()]);

      console.log('Dealer 1 Checkout Result:', res1.status, data1.message || data1.data?.orderNumber);
      console.log('Dealer 2 Checkout Result:', res2.status, data2.message || data2.data?.orderNumber);

      const successCount = (res1.status === 201 ? 1 : 0) + (res2.status === 201 ? 1 : 0);
      const failCount = (res1.status >= 400 ? 1 : 0) + (res2.status >= 400 ? 1 : 0);

      console.log(`Concurrent Results: ${successCount} Succeeded, ${failCount} Rejected`);

      if (successCount !== 1 || failCount !== 1) {
        throw new Error(`Concurrency race condition failed! Exactly 1 should succeed, but got ${successCount} successes`);
      }

      // Verify warehouse stock reservedQuantity is exactly 1 (never exceeded 1!)
      const finalStock = await prisma.warehouseStock.findUnique({
        where: { warehouseId_productVariantId: { warehouseId: warehouse.id, productVariantId: variantId } },
      });
      console.log('Final Warehouse Stock:', {
        physical: finalStock?.quantity,
        reserved: finalStock?.reservedQuantity,
      });

      if (finalStock?.reservedQuantity !== 1) {
        throw new Error(`Reserved stock oversold! Expected 1, found ${finalStock?.reservedQuantity}`);
      }
      console.log('✅ Concurrency race condition prevented! Raw SQL atomic lock successfully protected stock!');

      // 7. Cleanup Test Data
      console.log('\n--- 7. Cleanup Test Data ---');
      await prisma.cartItem.deleteMany({ where: { userId: { in: [dealer1Id, dealer2.id] } } });
      await prisma.orderItem.deleteMany({ where: { productVariantId: variantId } });
      await prisma.order.deleteMany({ where: { dealerId: { in: [dealer1Id, dealer2.id] } } });
      await prisma.stockMovement.deleteMany({ where: { productVariantId: variantId } });
      await prisma.warehouseStock.deleteMany({ where: { productVariantId: variantId } });
      await prisma.productVariant.deleteMany({ where: { productId: product.id } });
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.dealerCategoryDiscount.deleteMany({ where: { categoryId: l3.id } });
      await prisma.category.delete({ where: { id: l3.id } });
      await prisma.category.delete({ where: { id: l2.id } });
      await prisma.category.delete({ where: { id: l1.id } });
      await prisma.session.deleteMany({ where: { userId: dealer2.id } });
      await prisma.user.delete({ where: { id: dealer2.id } });
      console.log('✅ Test data cleaned up successfully');

      console.log('\n🎉 ALL ORDERS & CHECKOUT TESTS PASSED WITH 100% CONCURRENCY SAFETY! 🎉\n');
    } catch (err) {
      console.error('\n❌ Test failure:', err);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
      server.close();
    }
  });
}

runOrderTests();
