import app from '../src/app.js';
import { Server } from 'http';
import { prisma } from '../src/common/prisma.js';

let server: Server;
const PORT = 5003;
const BASE_URL = `http://localhost:${PORT}`;

async function runCategoryTests() {
  server = app.listen(PORT, async () => {
    console.log(`🧪 Category test server running at ${BASE_URL}`);

    try {
      // 1. Login as Admin
      console.log('\n--- 1. Login as Admin ---');
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@nextrade.com',
          password: 'Admin@123456',
        }),
      });
      const loginData: any = await loginRes.json();
      if (loginRes.status !== 200 || !loginData.data?.accessToken) {
        throw new Error('Admin login failed');
      }
      const adminToken = loginData.data.accessToken;
      console.log('✅ Admin authenticated successfully');

      // 2. Create Level 1: Root Category ("Industrial Hardware")
      console.log('\n--- 2. Create Level 1 Category (Root) ---');
      const l1Res = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Industrial Hardware',
          description: 'Industrial grade supplies and tools',
        }),
      });
      const l1Data: any = await l1Res.json();
      console.log('Level 1 Creation:', l1Res.status, l1Data.data?.name, `Level: ${l1Data.data?.level}`, `Badge: ${l1Data.data?.levelBadge}`, `Breadcrumb: ${l1Data.data?.breadcrumbPath}`);
      if (l1Res.status !== 201 || l1Data.data?.level !== 1 || l1Data.data?.levelBadge !== 'Root') {
        throw new Error('Level 1 category creation failed');
      }
      const l1Id = l1Data.data.id;

      // 3. Create Level 2: Subcategory ("Fasteners")
      console.log('\n--- 3. Create Level 2 Category (Subcategory) ---');
      const l2Res = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Fasteners',
          parentId: l1Id,
        }),
      });
      const l2Data: any = await l2Res.json();
      console.log('Level 2 Creation:', l2Res.status, l2Data.data?.name, `Level: ${l2Data.data?.level}`, `Badge: ${l2Data.data?.levelBadge}`, `Breadcrumb: ${l2Data.data?.breadcrumbPath}`);
      if (l2Res.status !== 201 || l2Data.data?.level !== 2 || l2Data.data?.levelBadge !== 'Subcategory') {
        throw new Error('Level 2 category creation failed');
      }
      const l2Id = l2Data.data.id;

      // 4. Create Level 3: Child Category ("Hex Bolts")
      console.log('\n--- 4. Create Level 3 Category (Child) ---');
      const l3Res = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Hex Bolts',
          parentId: l2Id,
        }),
      });
      const l3Data: any = await l3Res.json();
      console.log('Level 3 Creation:', l3Res.status, l3Data.data?.name, `Level: ${l3Data.data?.level}`, `Badge: ${l3Data.data?.levelBadge}`, `Breadcrumb: ${l3Data.data?.breadcrumbPath}`);
      if (l3Res.status !== 201 || l3Data.data?.level !== 3 || l3Data.data?.levelBadge !== 'Child') {
        throw new Error('Level 3 category creation failed');
      }
      const l3Id = l3Data.data.id;

      // 5. Attempt creating Level 4 (Should Fail: Max Depth 3)
      console.log('\n--- 5. Attempt Creating Level 4 Category (Expect 400 Max Depth Exceeded) ---');
      const l4Res = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Stainless Steel Hex Bolts',
          parentId: l3Id,
        }),
      });
      const l4Data: any = await l4Res.json();
      console.log('Level 4 Attempt Status:', l4Res.status, `Message: ${l4Data.message}`);
      if (l4Res.status !== 400 || !l4Data.message.includes('Maximum category nesting depth is 3 levels')) {
        throw new Error('Expected 400 error for exceeding 3 levels nesting');
      }

      // 6. Test GET /api/categories/tree
      console.log('\n--- 6. Test GET /api/categories/tree ---');
      const treeRes = await fetch(`${BASE_URL}/api/categories/tree`);
      const treeData: any = await treeRes.json();
      console.log('Tree status:', treeRes.status, `Total Root Nodes: ${treeData.data?.length}`);
      const rootNode = treeData.data?.find((n: any) => n.id === l1Id);
      if (!rootNode) throw new Error('Root category not found in tree');
      const subNode = rootNode.children?.find((n: any) => n.id === l2Id);
      if (!subNode) throw new Error('Subcategory not found under root in tree');
      const childNode = subNode.children?.find((n: any) => n.id === l3Id);
      if (!childNode) throw new Error('Child category not found under subcategory in tree');
      console.log(`✅ Hierarchy confirmed: ${rootNode.name} -> ${subNode.name} -> ${childNode.name}`);

      // 7. Test Deleting Parent with Children (Should Fail with 400)
      console.log('\n--- 7. Attempt Deleting Parent with Children (Expect 400) ---');
      const delParentRes = await fetch(`${BASE_URL}/api/categories/${l1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const delParentData: any = await delParentRes.json();
      console.log('Delete Parent Status:', delParentRes.status, `Message: ${delParentData.message}`);
      if (delParentRes.status !== 400 || !delParentData.message.includes('subcategories')) {
        throw new Error('Expected 400 error when deleting parent category with children');
      }

      // 8. Delete in Reverse Order (L3 -> L2 -> L1)
      console.log('\n--- 8. Delete in Reverse Order ---');
      const del3 = await fetch(`${BASE_URL}/api/categories/${l3Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const del2 = await fetch(`${BASE_URL}/api/categories/${l2Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const del1 = await fetch(`${BASE_URL}/api/categories/${l1Id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log(`Delete L3 (${del3.status}), Delete L2 (${del2.status}), Delete L1 (${del1.status})`);
      if (del3.status !== 200 || del2.status !== 200 || del1.status !== 200) {
        throw new Error('Reverse deletion failed');
      }

      console.log('\n🎉 ALL CATEGORIES MODULE TESTS PASSED! 🎉\n');
    } catch (err) {
      console.error('\n❌ Test failure:', err);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
      server.close();
    }
  });
}

runCategoryTests();
