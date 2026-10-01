import app from '../src/app.js';
import { Server } from 'http';
import { prisma } from '../src/common/prisma.js';

let server: Server;
const PORT = 5004;
const BASE_URL = `http://localhost:${PORT}`;

async function runProductTests() {
  server = app.listen(PORT, async () => {
    console.log(`🧪 Product test server running at ${BASE_URL}`);

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
      const dealerId = dealerLogin.data?.user?.id;
      if (!dealerToken || !dealerId) throw new Error('Dealer login failed');
      console.log('✅ Admin and Dealer tokens acquired');

      // 2. Setup 3-Level Category Hierarchy
      console.log('\n--- 2. Setting up 3-Level Category Hierarchy ---');
      const l1 = await prisma.category.create({
        data: { name: 'Fasteners & Fixings', slug: 'fasteners-fixings-test', level: 1 },
      });
      const l2 = await prisma.category.create({
        data: { name: 'Bolts & Screws', slug: 'bolts-screws-test', level: 2, parentId: l1.id },
      });
      const l3 = await prisma.category.create({
        data: { name: 'High Tensile Hex Bolts', slug: 'high-tensile-hex-bolts-test', level: 3, parentId: l2.id },
      });
      console.log(`✅ Created Categories: L1 (${l1.name}), L2 (${l2.name}), L3 (${l3.name})`);

      // 3. Create Brand
      console.log('\n--- 3. Create Brand ---');
      const brandRes = await fetch(`${BASE_URL}/api/brands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'UltraFasten Pro',
          description: 'High tensile industrial bolts and fasteners',
        }),
      });
      const brandData: any = await brandRes.json();
      console.log('Brand Creation:', brandRes.status, brandData.data?.name, `Slug: ${brandData.data?.slug}`);
      if (brandRes.status !== 201) throw new Error('Brand creation failed');
      const brandId = brandData.data.id;

      // 4. Test Rejection when linking to Level 1 or Level 2 Category
      console.log('\n--- 4. Verify Level 1 & Level 2 Rejection ---');
      const l1Attempt = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Invalid Level 1 Product',
          categoryId: l1.id,
          variants: [{ name: 'V1', price: 100 }],
        }),
      });
      const l1AttemptData: any = await l1Attempt.json();
      console.log('Level 1 Rejection Status:', l1Attempt.status, `Message: ${l1AttemptData.message}`);
      if (l1Attempt.status !== 400 || !l1AttemptData.message.includes('Level 3')) {
        throw new Error('Expected 400 rejection for Level 1 category assignment');
      }

      const l2Attempt = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Invalid Level 2 Product',
          categoryId: l2.id,
          variants: [{ name: 'V1', price: 100 }],
        }),
      });
      const l2AttemptData: any = await l2Attempt.json();
      console.log('Level 2 Rejection Status:', l2Attempt.status, `Message: ${l2AttemptData.message}`);
      if (l2Attempt.status !== 400 || !l2AttemptData.message.includes('Level 3')) {
        throw new Error('Expected 400 rejection for Level 2 category assignment');
      }

      // 5. Create Product with Level 3 Category + 1 Initial Variant
      console.log('\n--- 5. Create Product with Level 3 Category & Initial Variant ---');
      const prodRes = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Hex Head Bolt M10',
          categoryId: l3.id,
          brandId,
          description: 'Class 8.8 high tensile steel hex bolt',
          images: ['https://example.com/bolt-m10.jpg'],
          variants: [
            {
              name: 'M10 x 30mm',
              price: 100,
              mrp: 130,
              gstPercentage: 18,
              minimumQuantity: 10,
              packingDetails: 'Box of 50 pcs',
            },
          ],
        }),
      });
      const prodData: any = await prodRes.json();
      console.log('Product Creation Status:', prodRes.status, `SKU: ${prodData.data?.sku}`);
      console.log('Initial Variant SKU:', prodData.data?.variants?.[0]?.sku);
      if (prodRes.status !== 201) throw new Error('Product creation failed');
      const productId = prodData.data.id;

      // Verify SKU format: NEX-HIG-00001 and variant SKU NEX-HIG-00001-V1
      if (!prodData.data.sku.startsWith('NEX-') || !prodData.data.sku.endsWith('-00001')) {
        throw new Error(`SKU pattern mismatch: ${prodData.data.sku}`);
      }
      if (prodData.data.variants[0].sku !== `${prodData.data.sku}-V1`) {
        throw new Error(`Variant SKU pattern mismatch: ${prodData.data.variants[0].sku}`);
      }
      console.log('✅ Product and Variant 1 SKU patterns match expected format!');

      // 6. Add 2nd Variant via /api/products/:id/variants
      console.log('\n--- 6. Add 2nd Variant via Sub-route ---');
      const var2Res = await fetch(`${BASE_URL}/api/products/${productId}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'M10 x 50mm Zinc Plated',
          price: 150,
          mrp: 190,
          gstPercentage: 18,
          minimumQuantity: 10,
          packingDetails: 'Box of 50 pcs',
        }),
      });
      const var2Data: any = await var2Res.json();
      console.log('Variant 2 Creation Status:', var2Res.status, `SKU: ${var2Data.data?.sku}`);
      if (var2Res.status !== 201 || var2Data.data?.sku !== `${prodData.data.sku}-V2`) {
        throw new Error(`Variant 2 SKU mismatch: expected ${prodData.data.sku}-V2, got ${var2Data.data?.sku}`);
      }
      console.log('✅ Variant 2 added with SKU:', var2Data.data.sku);

      // 7. Setup Dealer Discount on Level 3 Category (10%)
      console.log('\n--- 7. Setup 10% Dealer Discount on Category ---');
      await prisma.dealerCategoryDiscount.upsert({
        where: {
          dealerId_categoryId: {
            dealerId,
            categoryId: l3.id,
          },
        },
        update: { discountPercentage: 10.0 },
        create: {
          dealerId,
          categoryId: l3.id,
          discountPercentage: 10.0,
        },
      });
      console.log('✅ Configured 10% discount for dealer on category:', l3.name);

      // 8. Dealer Views Product Details -> Verify Effective Price
      console.log('\n--- 8. Dealer Views Product Detail (Verify Dealer Pricing) ---');
      const dealerViewRes = await fetch(`${BASE_URL}/api/products/${productId}`, {
        headers: { Authorization: `Bearer ${dealerToken}` },
      });
      const dealerViewData: any = await dealerViewRes.json();
      console.log('Dealer View Status:', dealerViewRes.status);
      console.log('Dealer Category Discount Applied:', `${dealerViewData.data?.dealerDiscountPercent}%`);

      const v1 = dealerViewData.data?.variants?.find((v: any) => v.name === 'M10 x 30mm');
      const v2 = dealerViewData.data?.variants?.find((v: any) => v.name === 'M10 x 50mm Zinc Plated');

      console.log(`V1 (Price: ₹${v1?.price}) -> Effective: ₹${v1?.effectivePrice} (Expected: ₹90.00)`);
      console.log(`V2 (Price: ₹${v2?.price}) -> Effective: ₹${v2?.effectivePrice} (Expected: ₹135.00)`);

      if (v1?.effectivePrice !== 90 || v2?.effectivePrice !== 135) {
        throw new Error(`Effective price mismatch! V1: ${v1?.effectivePrice}, V2: ${v2?.effectivePrice}`);
      }
      console.log('✅ Dealer effective pricing calculation verified!');

      // 9. Verify Deletion Guards
      console.log('\n--- 9. Verify Brand Deletion Guard ---');
      const delBrandRes = await fetch(`${BASE_URL}/api/brands/${brandId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const delBrandData: any = await delBrandRes.json();
      console.log('Delete Brand Status:', delBrandRes.status, `Message: ${delBrandData.message}`);
      if (delBrandRes.status !== 400 || !delBrandData.message.includes('linked to')) {
        throw new Error('Expected 400 error when deleting brand with existing products');
      }
      console.log('✅ Brand deletion guard prevented deleting brand with products');

      // Clean up test data
      console.log('\n--- 10. Clean up test data ---');
      await prisma.productVariant.deleteMany({ where: { productId } });
      await prisma.product.delete({ where: { id: productId } });
      await prisma.brand.delete({ where: { id: brandId } });
      await prisma.dealerCategoryDiscount.deleteMany({ where: { categoryId: l3.id } });
      await prisma.category.delete({ where: { id: l3.id } });
      await prisma.category.delete({ where: { id: l2.id } });
      await prisma.category.delete({ where: { id: l1.id } });
      console.log('✅ Cleaned up test data');

      console.log('\n🎉 ALL PRODUCTS & BRANDS TESTS PASSED SUCCESSFULLY! 🎉\n');
    } catch (err) {
      console.error('\n❌ Test failure:', err);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
      server.close();
    }
  });
}

runProductTests();
