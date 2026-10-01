import app from '../src/app.js';
import { Server } from 'http';
import { prisma } from '../src/common/prisma.js';

let server: Server;
const PORT = 5002;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  server = app.listen(PORT, async () => {
    console.log(`🧪 Test server running at ${BASE_URL}`);

    try {
      // 1. Healthcheck
      console.log('\n--- 1. Testing Healthcheck ---');
      const healthRes = await fetch(`${BASE_URL}/health`);
      const healthData: any = await healthRes.json();
      console.log('Healthcheck Response:', healthRes.status, healthData);
      if (healthRes.status !== 200) throw new Error('Health check failed');

      // 2. Dealer Registration
      console.log('\n--- 2. Testing Dealer Registration (Status: PENDING) ---');
      const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Rohan Sharma',
          email: 'rohan@sharmatools.com',
          password: 'Password@123',
          phone: '9876543210',
          businessName: 'Sharma Tools & Fasteners',
          businessAddress: 'Sector 18, Noida',
          gstNumber: '07AAAAA0000A1Z5',
        }),
      });
      const regData: any = await regRes.json();
      console.log('Registration Response:', regRes.status, regData);
      if (regRes.status !== 201 || regData.data.status !== 'PENDING') {
        throw new Error('Registration failed or status is not PENDING');
      }

      // 3. Attempt Login as Pending Dealer (Should Fail with 403)
      console.log('\n--- 3. Testing Pending Dealer Login (Expect 403 Forbidden) ---');
      const pendingLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'rohan@sharmatools.com',
          password: 'Password@123',
        }),
      });
      const pendingLoginData: any = await pendingLoginRes.json();
      console.log('Pending Dealer Login Status:', pendingLoginRes.status, pendingLoginData.message);
      if (pendingLoginRes.status !== 403) {
        throw new Error('Expected 403 for pending dealer login');
      }

      // 4. Admin Login
      console.log('\n--- 4. Testing Admin Login ---');
      const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@nextrade.com',
          password: 'Admin@123456',
        }),
      });
      const adminLoginData: any = await adminLoginRes.json();
      console.log('Admin Login Response:', adminLoginRes.status, adminLoginData.data?.user);
      if (adminLoginRes.status !== 200 || !adminLoginData.data?.accessToken) {
        throw new Error('Admin login failed');
      }
      const adminToken = adminLoginData.data.accessToken;

      // 5. Admin /me endpoint
      console.log('\n--- 5. Testing Authenticated /api/auth/me ---');
      const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const meData: any = await meRes.json();
      console.log('Admin /me Response:', meRes.status, meData.data?.user);
      if (meRes.status !== 200 || meData.data?.user?.email !== 'admin@nextrade.com') {
        throw new Error('/me endpoint failed');
      }

      // 6. Approved Dealer Login
      console.log('\n--- 6. Testing Approved Dealer Login ---');
      const dealerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'dealer@apexhardware.com',
          password: 'Dealer@123456',
        }),
      });
      const dealerLoginData: any = await dealerLoginRes.json();
      console.log('Approved Dealer Login Response:', dealerLoginRes.status, dealerLoginData.data?.user);
      if (dealerLoginRes.status !== 200) {
        throw new Error('Approved dealer login failed');
      }
      const approvedDealerId = dealerLoginData.data.user.id;

      // 7. Admin Impersonating Dealer
      console.log('\n--- 7. Testing Admin Impersonating Dealer ---');
      const impRes = await fetch(`${BASE_URL}/api/auth/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ dealerId: approvedDealerId }),
      });
      const impData: any = await impRes.json();
      console.log('Impersonate Response:', impRes.status, impData.data?.user);
      if (impRes.status !== 200 || impData.data?.user?.impersonatedBy !== meData.data.user.id) {
        throw new Error('Impersonation failed');
      }

      console.log('\n🎉 ALL AUTH & SECURITY TESTS PASSED SUCCESSFULLY! 🎉\n');
    } catch (err) {
      console.error('\n❌ Test failure:', err);
      process.exitCode = 1;
    } finally {
      // Clean up test user
      await prisma.user.deleteMany({ where: { email: 'rohan@sharmatools.com' } });
      await prisma.$disconnect();
      server.close();
    }
  });
}

runTests();
