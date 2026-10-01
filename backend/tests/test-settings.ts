import app from '../src/app.js';
import { Server } from 'http';
import { prisma } from '../src/common/prisma.js';

let server: Server;
const PORT = 5010;
const BASE_URL = `http://localhost:${PORT}`;

async function runSettingsTests() {
  server = app.listen(PORT, async () => {
    console.log(`🧪 Settings test server running at ${BASE_URL}`);

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

      // 2. Initialize Defaults (POST /api/settings/initialize)
      console.log('\n--- 2. Initializing Default Settings ---');
      const initRes = await fetch(`${BASE_URL}/api/settings/initialize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const initData: any = await initRes.json();
      console.log(`   Initialize response: ${initData.message}`);
      if (!initRes.ok || !initData.success) {
        throw new Error('Failed to initialize settings: ' + JSON.stringify(initData));
      }
      console.log('✅ Default settings initialized successfully');

      // 3. Retrieve Grouped Settings (GET /api/settings)
      console.log('\n--- 3. Retrieving Grouped Settings Object ---');
      const getAllRes = await fetch(`${BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const getAllData: any = await getAllRes.json();
      const settings = getAllData.data;

      console.log('   Keys returned in grouped settings:', Object.keys(settings));
      if (
        !settings.COMPANY_INFO ||
        !settings.INVOICE_SETTINGS ||
        !settings.INVENTORY_SETTINGS ||
        !settings.NOTIFICATION_SETTINGS
      ) {
        throw new Error('Grouped settings missing one or more required keys!');
      }
      console.log(`   Company Name: ${settings.COMPANY_INFO.name}`);
      console.log(`   Default Credit Days: ${settings.INVOICE_SETTINGS.defaultCreditDays}`);
      console.log(`   Default Reorder Point: ${settings.INVENTORY_SETTINGS.defaultReorderPoint}`);
      console.log('✅ Grouped settings retrieved with all 4 setting sections');

      // 4. Update COMPANY_INFO (PUT /api/settings/COMPANY_INFO)
      console.log('\n--- 4. Updating COMPANY_INFO Setting ---');
      const updatedCompanyData = {
        name: 'NexTrade Industrial Technologies India Pvt Ltd',
        address: 'Tower B, Level 14, Commercial Hub, Bandra Kurla Complex',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400051',
        phone: '+91 22 6600 7700',
        email: 'billing@nextrade-tech.com',
        website: 'https://www.nextrade-tech.com',
        gstNumber: '27AAACN5432B1Z8',
        logo: 'https://assets.nextrade.com/logo-hd.png',
      };

      const updateRes = await fetch(`${BASE_URL}/api/settings/COMPANY_INFO`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(updatedCompanyData),
      });
      const updateData: any = await updateRes.json();
      if (!updateRes.ok) throw new Error('Update failed: ' + JSON.stringify(updateData));
      console.log(`✅ Setting updated: ${updateData.message}`);
      console.log(`   New Company Name: ${updateData.data.value.name}`);
      console.log(`   New GST Number: ${updateData.data.value.gstNumber}`);

      if (updateData.data.value.name !== updatedCompanyData.name) {
        throw new Error('Updated company name mismatch');
      }

      // 5. Retrieve Specific Setting (GET /api/settings/COMPANY_INFO)
      console.log('\n--- 5. Retrieving Specific Setting ---');
      const getSingleRes = await fetch(`${BASE_URL}/api/settings/COMPANY_INFO`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const getSingleData: any = await getSingleRes.json();
      console.log(`✅ Fetched single setting: key=${getSingleData.data.key}, name=${getSingleData.data.value.name}`);
      if (getSingleData.data.value.gstNumber !== updatedCompanyData.gstNumber) {
        throw new Error('Single setting value mismatch');
      }

      // 6. Validation Guard: Invalid Pincode & Invalid GST
      console.log('\n--- 6. Testing Validation Guards ---');
      const invalidUpdateRes = await fetch(`${BASE_URL}/api/settings/COMPANY_INFO`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          ...updatedCompanyData,
          pincode: '400', // Invalid (must be 6 digits)
        }),
      });
      const invalidData: any = await invalidUpdateRes.json();
      console.log(`   Invalid pincode status: ${invalidUpdateRes.status}, error: ${invalidData.message}`);
      if (invalidUpdateRes.status !== 400) {
        throw new Error(`Expected 400 Bad Request for invalid pincode, got ${invalidUpdateRes.status}`);
      }
      console.log('✅ Validation correctly blocked invalid setting payload');

      // 7. Dealer Access & Permissions
      console.log('\n--- 7. Testing Dealer Access & Permission Guards ---');

      // 7a. Dealer CAN access /api/settings/public
      const publicRes = await fetch(`${BASE_URL}/api/settings/public`, {
        headers: { Authorization: `Bearer ${dealerToken}` },
      });
      const publicData: any = await publicRes.json();
      console.log(`   Dealer /api/settings/public status: ${publicRes.status}`);
      if (!publicRes.ok || !publicData.success) {
        throw new Error('Dealer failed to access public settings: ' + JSON.stringify(publicData));
      }
      console.log(`   Public Company Name: ${publicData.data.company.name}`);
      console.log(`   Public Bank Account: ${publicData.data.bankDetails.accountNumber} (${publicData.data.bankDetails.bankName})`);
      if (
        !publicData.data.company.name ||
        !publicData.data.company.gstNumber ||
        !publicData.data.bankDetails.accountNumber
      ) {
        throw new Error('Public settings payload missing required fields');
      }
      console.log('✅ Dealer successfully accessed public settings and bank details');

      // 7b. Dealer CANNOT access /api/settings (403)
      const dealerGetAllAttempt = await fetch(`${BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${dealerToken}` },
      });
      console.log(`   Dealer access to /api/settings status: ${dealerGetAllAttempt.status}`);
      if (dealerGetAllAttempt.status !== 403) {
        throw new Error(`Expected 403 Forbidden for dealer accessing /api/settings, got ${dealerGetAllAttempt.status}`);
      }

      // 7c. Dealer CANNOT update settings (403)
      const dealerPutAttempt = await fetch(`${BASE_URL}/api/settings/COMPANY_INFO`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${dealerToken}`,
        },
        body: JSON.stringify(updatedCompanyData),
      });
      console.log(`   Dealer update attempt status: ${dealerPutAttempt.status}`);
      if (dealerPutAttempt.status !== 403) {
        throw new Error(`Expected 403 Forbidden for dealer updating settings, got ${dealerPutAttempt.status}`);
      }
      console.log('✅ Dealer strictly blocked from admin settings endpoints (403 Forbidden)');

      console.log('\n🎉 ALL STEP 11 SETTINGS MODULE TESTS PASSED SUCCESSFULLY!');
    } catch (err: any) {
      console.error('\n❌ Settings test failed:', err);
      process.exitCode = 1;
    } finally {
      server.close();
      await prisma.$disconnect();
    }
  });
}

runSettingsTests();
