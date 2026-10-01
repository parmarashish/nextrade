import app from '../src/app.js';
import { Server } from 'http';
import { prisma } from '../src/common/prisma.js';
import { UserRole } from '@prisma/client';

let server: Server;
const PORT = 5011;
const BASE_URL = `http://localhost:${PORT}`;

async function runSeedVerification() {
  server = app.listen(PORT, async () => {
    console.log(`\n======================================================`);
    console.log(`🔍 RUNNING SEED DATA POST-VERIFICATION AT ${BASE_URL}`);
    console.log(`======================================================\n`);

    try {
      // 1. Admin login works
      console.log('1. Testing Admin Login (admin@nextrade.com)...');
      const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@nextrade.com', password: 'Admin@123' }),
      });
      const adminData: any = await adminRes.json();
      if (!adminRes.ok || !adminData.data?.accessToken) {
        throw new Error('Admin login failed: ' + JSON.stringify(adminData));
      }
      const adminToken = adminData.data.accessToken;
      console.log(`   ✅ Admin login successful! Role: ${adminData.data.user.role}`);

      // 2. All 3 dealer logins work
      console.log('\n2. Testing All 3 Approved Dealer Logins...');
      const dealerEmails = [
        { email: 'apex@nextrade.com', name: 'Apex Hardware Solutions' },
        { email: 'buildmart@nextrade.com', name: 'BuildMart Industries' },
        { email: 'profix@nextrade.com', name: 'ProFix Traders' },
      ];

      for (const d of dealerEmails) {
        const dRes = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: d.email, password: 'Dealer@123' }),
        });
        const dData: any = await dRes.json();
        if (!dRes.ok || !dData.data?.accessToken) {
          throw new Error(`Dealer login failed for ${d.email}: ${JSON.stringify(dData)}`);
        }
        console.log(`   ✅ Login successful for: ${d.name} (${d.email})`);
      }

      // 3. Pending dealer gets 403 with correct message
      console.log('\n3. Testing Pending Dealer Login...');
      const pendingRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'pending@nextrade.com', password: 'Dealer@123' }),
      });
      const pendingData: any = await pendingRes.json();
      console.log(`   Status: ${pendingRes.status}`);
      console.log(`   Message: "${pendingData.message}"`);
      if (pendingRes.status !== 403 || !pendingData.message.toLowerCase().includes('pending')) {
        throw new Error(`Expected 403 Forbidden with pending message, got: ${pendingRes.status} ${JSON.stringify(pendingData)}`);
      }
      console.log('   ✅ Pending dealer blocked with 403 and informative message');

      // 3b. Rejected dealer gets 403 with rejection reason
      console.log('\n3b. Testing Rejected Dealer Login...');
      const rejectedRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'rejected@nextrade.com', password: 'Dealer@123' }),
      });
      const rejectedData: any = await rejectedRes.json();
      console.log(`   Status: ${rejectedRes.status}`);
      console.log(`   Message: "${rejectedData.message}"`);
      if (rejectedRes.status !== 403 || !rejectedData.message.toLowerCase().includes('rejected')) {
        throw new Error(`Expected 403 with rejection reason, got: ${rejectedRes.status}`);
      }
      console.log('   ✅ Rejected dealer blocked with 403 and rejection reason');

      // 4. Reports summary shows non-zero revenue
      console.log('\n4. Verifying Reports Summary KPIs...');
      const summaryRes = await fetch(`${BASE_URL}/api/reports/summary`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const summaryData: any = await summaryRes.json();
      console.log('   Summary KPIs:', summaryData.data);
      if (!summaryRes.ok || summaryData.data.totalRevenue <= 0) {
        throw new Error(`Expected positive revenue in summary, got: ${summaryData.data?.totalRevenue}`);
      }
      console.log(`   ✅ Non-zero delivered revenue verified: ₹${summaryData.data.totalRevenue}`);

      // 5. Inventory report shows low stock alerts
      console.log('\n5. Verifying Inventory Report Low Stock Alerts...');
      const invRes = await fetch(`${BASE_URL}/api/reports/inventory`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const invData: any = await invRes.json();
      console.log(`   Total Stock Value: ₹${invData.data.totalStockValue}`);
      console.log(`   Low Stock Count: ${invData.data.lowStockCount}`);
      console.log(`   Warehouses reported: ${invData.data.stockByWarehouse.length}`);
      if (!invRes.ok || invData.data.lowStockCount <= 0) {
        throw new Error(`Expected lowStockCount > 0, got: ${invData.data?.lowStockCount}`);
      }
      console.log(`   ✅ Low stock alerts active (${invData.data.lowStockCount} items flagged)`);

      // 6. At least 2 invoices generated with correct format
      console.log('\n6. Verifying Seeded Invoices Format...');
      const invoicesRes = await fetch(`${BASE_URL}/api/invoices`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const invoicesData: any = await invoicesRes.json();
      const invoiceList = invoicesData.data;
      console.log(`   Total Invoices Found: ${invoiceList.length}`);
      if (invoiceList.length < 2) {
        throw new Error(`Expected at least 2 invoices, got: ${invoiceList.length}`);
      }
      const invRegex = /^INV-(MUM|DEL)-\d{4}-\d{5}$/;
      for (const inv of invoiceList.slice(0, 3)) {
        console.log(`   Checking invoice #${inv.invoiceNumber}: ${invRegex.test(inv.invoiceNumber) ? 'VALID FORMAT' : 'INVALID'}`);
        if (!invRegex.test(inv.invoiceNumber)) {
          throw new Error(`Invoice number ${inv.invoiceNumber} failed format validation`);
        }
      }
      console.log('   ✅ Invoices format verified (INV-{WH}-{FY}-{SEQ})');

      // 7. Final Database Counts
      console.log('\n======================================================');
      console.log('📊 FINAL VERIFIED DATABASE COUNTS');
      console.log('======================================================');

      const [
        totalUsers,
        totalDealers,
        totalProducts,
        totalVariants,
        totalWarehouses,
        totalOrders,
        totalDispatches,
        totalInvoices,
        totalPayments,
        totalActivityLogs,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: UserRole.DEALER } }),
        prisma.product.count(),
        prisma.productVariant.count(),
        prisma.warehouse.count(),
        prisma.order.count(),
        prisma.dispatch.count(),
        prisma.order.count({ where: { invoiceNumber: { not: null } } }),
        prisma.payment.count(),
        prisma.activityLog.count(),
      ]);

      console.log(`- Users:         ${totalUsers}`);
      console.log(`- Dealers:       ${totalDealers}`);
      console.log(`- Warehouses:    ${totalWarehouses}`);
      console.log(`- Products:      ${totalProducts}`);
      console.log(`- Variants:      ${totalVariants}`);
      console.log(`- Orders:        ${totalOrders}`);
      console.log(`- Dispatches:    ${totalDispatches}`);
      console.log(`- Invoices:      ${totalInvoices}`);
      console.log(`- Payments:      ${totalPayments}`);
      console.log(`- ActivityLogs:  ${totalActivityLogs}`);
      console.log('======================================================\n');
      console.log('🎉 ALL SEED VERIFICATION CHECKS PASSED PERFECTLY!\n');
    } catch (err: any) {
      console.error('\n❌ Seed verification failed:', err);
      process.exitCode = 1;
    } finally {
      server.close();
      await prisma.$disconnect();
    }
  });
}

runSeedVerification();
