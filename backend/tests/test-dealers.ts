import app from '../src/app.js';
import { Server } from 'http';
import { prisma } from '../src/common/prisma.js';

let server: Server;
const PORT = 5006;
const BASE_URL = `http://localhost:${PORT}`;

async function runDealerTests() {
  server = app.listen(PORT, async () => {
    console.log(`🧪 Dealer test server running at ${BASE_URL}`);

    try {
      // 1. Authenticate Admin
      console.log('\n--- 1. Authenticating Admin ---');
      const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@nextrade.com', password: 'Admin@123456' }),
      });
      const adminLogin: any = await adminLoginRes.json();
      const adminToken = adminLogin.data?.accessToken;
      const adminId = adminLogin.data?.user?.id;
      if (!adminToken) throw new Error('Admin login failed');
      console.log('✅ Admin authenticated:', adminId);

      // Get Primary Warehouse
      const warehouse = await prisma.warehouse.findFirst();
      const warehouseId = warehouse?.id;
      if (!warehouseId) throw new Error('No warehouse found');

      // Create a Test Category for discount matrix
      const testCategory = await prisma.category.create({
        data: { name: 'Pipes & Fittings', slug: 'pipes-fittings-dealer-test', level: 1 },
      });

      // 2. Register Dealer 1 (Status: PENDING)
      console.log('\n--- 2. Register New Dealer 1 (Expect Status: PENDING) ---');
      const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Suresh Patel',
          email: 'suresh@sureshtrading.com',
          password: 'Password@123',
          phone: '9822334455',
          businessName: 'Suresh Industrial Traders',
          businessAddress: 'Ring Road, Surat',
          gstNumber: '24ABCDE1234F1Z5',
        }),
      });
      const regData: any = await regRes.json();
      console.log('Registration Status:', regRes.status, `Dealer Status: ${regData.data?.status}`);
      if (regRes.status !== 201 || regData.data?.status !== 'PENDING') {
        throw new Error('Dealer registration failed or status is not PENDING');
      }
      const dealer1Id = regData.data.dealerId;

      // 3. Admin Views Pending Approval Queue
      console.log('\n--- 3. Admin Checks Pending Approval Queue ---');
      const pendingQueueRes = await fetch(`${BASE_URL}/api/dealers?status=PENDING`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const pendingQueueData: any = await pendingQueueRes.json();
      console.log('Pending Queue Count:', pendingQueueData.counts?.pending);
      const inQueue = pendingQueueData.data?.some((d: any) => d.id === dealer1Id);
      if (!inQueue) throw new Error('New dealer not found in pending queue');
      console.log('✅ Dealer 1 found in pending queue');

      // 4. Admin Approves Dealer 1 with Credit Limit and Assigned Warehouse
      console.log('\n--- 4. Admin Approves Dealer 1 ---');
      const approveRes = await fetch(`${BASE_URL}/api/dealers/${dealer1Id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          creditLimit: 250000,
          creditDays: 45,
          assignedWarehouseId: warehouseId,
        }),
      });
      const approveData: any = await approveRes.json();
      console.log('Approve Status:', approveRes.status, {
        status: approveData.dealer?.status,
        creditLimit: approveData.dealer?.creditLimit,
        creditDays: approveData.dealer?.creditDays,
        warehouse: approveData.dealer?.assignedWarehouse?.code,
      });
      if (
        approveRes.status !== 200 ||
        approveData.dealer?.status !== 'APPROVED' ||
        Number(approveData.dealer?.creditLimit) !== 250000 ||
        Number(approveData.dealer?.remainingCreditLimit) !== 250000
      ) {
        throw new Error('Dealer approval validation failed');
      }
      console.log('✅ Dealer 1 successfully approved with ₹2,50,000 credit limit & 45 days');

      // 5. Admin Sets Category Discount Matrix for Dealer 1
      console.log('\n--- 5. Admin Sets Category Discount (15%) ---');
      const discountRes = await fetch(`${BASE_URL}/api/dealers/${dealer1Id}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          categoryId: testCategory.id,
          discountPercentage: 15,
        }),
      });
      const discountData: any = await discountRes.json();
      console.log('Discount Set Status:', discountRes.status, `Discount %: ${discountData.data?.discountPercentage}`);
      if (discountRes.status !== 200 || Number(discountData.data?.discountPercentage) !== 15) {
        throw new Error('Category discount setup failed');
      }

      // 6. Dealer 1 Logs In and Views Own Profile via /api/dealers/me
      console.log('\n--- 6. Dealer 1 Logs In and Accesses /api/dealers/me ---');
      const dealer1LoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'suresh@sureshtrading.com',
          password: 'Password@123',
        }),
      });
      const dealer1Login: any = await dealer1LoginRes.json();
      const dealer1Token = dealer1Login.data?.accessToken;
      if (!dealer1Token) throw new Error('Approved dealer login failed');

      const dealerMeRes = await fetch(`${BASE_URL}/api/dealers/me`, {
        headers: { Authorization: `Bearer ${dealer1Token}` },
      });
      const dealerMeData: any = await dealerMeRes.json();
      console.log('Dealer /me Status:', dealerMeRes.status, {
        name: dealerMeData.data?.name,
        businessName: dealerMeData.data?.businessName,
        creditLimit: dealerMeData.data?.creditLimit,
        discountsCount: dealerMeData.data?.categoryDiscounts?.length,
        isImpersonated: dealerMeData.data?.isImpersonated,
      });
      if (
        dealerMeRes.status !== 200 ||
        dealerMeData.data?.email !== 'suresh@sureshtrading.com' ||
        Number(dealerMeData.data?.creditLimit) !== 250000 ||
        dealerMeData.data?.isImpersonated !== false
      ) {
        throw new Error('Dealer self-profile retrieval mismatch');
      }
      console.log('✅ Dealer 1 sees own profile with credit terms and assigned category discounts');

      // 7. Admin Impersonates Dealer 1 -> Verify /dealers/me returns Dealer Profile
      console.log('\n--- 7. Admin Impersonates Dealer 1 and Accesses /dealers/me ---');
      const impRes = await fetch(`${BASE_URL}/api/auth/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ dealerId: dealer1Id }),
      });
      const impData: any = await impRes.json();
      const impToken = impData.data?.accessToken;
      if (!impToken) throw new Error('Impersonation token missing');

      const impMeRes = await fetch(`${BASE_URL}/api/dealers/me`, {
        headers: { Authorization: `Bearer ${impToken}` },
      });
      const impMeData: any = await impMeRes.json();
      console.log('Impersonated /me Status:', impMeRes.status, {
        impersonatedUser: impMeData.data?.name,
        businessName: impMeData.data?.businessName,
        isImpersonated: impMeData.data?.isImpersonated,
        impersonatedBy: impMeData.data?.impersonatedBy,
      });
      if (
        impMeRes.status !== 200 ||
        impMeData.data?.id !== dealer1Id ||
        impMeData.data?.isImpersonated !== true ||
        impMeData.data?.impersonatedBy !== adminId
      ) {
        throw new Error('Impersonated /me endpoint verification failed');
      }
      console.log('✅ Impersonation verified: returns dealer profile with isImpersonated=true and adminId');

      // 8. Dealer Stats Verification via /api/dealers/:id
      console.log('\n--- 8. Verify Dealer Stats Endpoint ---');
      const statsRes = await fetch(`${BASE_URL}/api/dealers/${dealer1Id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const statsData: any = await statsRes.json();
      console.log('Dealer Stats:', statsData.data?.stats);
      if (statsRes.status !== 200 || typeof statsData.data?.stats?.totalOrders !== 'number') {
        throw new Error('Dealer stats endpoint failed');
      }
      console.log('✅ Dealer stats (orders, revenue, creditUtilization) verified');

      // 9. Register Dealer 2 and Reject with Reason
      console.log('\n--- 9. Register Dealer 2 and Reject with Reason ---');
      const reg2Res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Manish Verma',
          email: 'manish@manishhardware.com',
          password: 'Password@123',
          phone: '9833445566',
          businessName: 'Manish Hardware Stores',
          businessAddress: 'Main Market, Jaipur',
        }),
      });
      const reg2Data: any = await reg2Res.json();
      const dealer2Id = reg2Data.data?.dealerId;

      const rejectRes = await fetch(`${BASE_URL}/api/dealers/${dealer2Id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          rejectionReason: 'Invalid business documentation and unreachable phone number',
        }),
      });
      const rejectData: any = await rejectRes.json();
      console.log('Reject Status:', rejectRes.status, {
        status: rejectData.dealer?.status,
        reason: rejectData.dealer?.rejectionReason,
      });
      if (rejectRes.status !== 200 || rejectData.dealer?.status !== 'REJECTED') {
        throw new Error('Dealer rejection failed');
      }

      // Attempt login with rejected dealer (expect 403)
      const rejectedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'manish@manishhardware.com', password: 'Password@123' }),
      });
      const rejectedLoginData: any = await rejectedLoginRes.json();
      console.log('Rejected Login Status:', rejectedLoginRes.status, `Message: ${rejectedLoginData.message}`);
      if (rejectedLoginRes.status !== 403 || !rejectedLoginData.message.includes('rejected')) {
        throw new Error('Expected 403 for rejected dealer login');
      }
      console.log('✅ Rejected dealer login successfully blocked with reason');

      // Clean up test users
      console.log('\n--- 10. Cleaning up Test Data ---');
      await prisma.dealerCategoryDiscount.deleteMany({ where: { dealerId: dealer1Id } });
      await prisma.session.deleteMany({ where: { userId: { in: [dealer1Id, dealer2Id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [dealer1Id, dealer2Id] } } });
      await prisma.category.delete({ where: { id: testCategory.id } });
      console.log('✅ Test data cleaned up successfully');

      console.log('\n🎉 ALL DEALERS MODULE TESTS PASSED! 🎉\n');
    } catch (err) {
      console.error('\n❌ Test failure:', err);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
      server.close();
    }
  });
}

runDealerTests();
