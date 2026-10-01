import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  UserRole,
  UserStatus,
  OrderStatus,
  PaymentStatus,
  DispatchStatus,
  StockMovementType,
} from '@prisma/client';
import { getIndianFinancialYear, extractWarehouseCodeForInvoice } from '../src/common/utils.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting NexTrade comprehensive database seed...');

  // ─── 0. CLEANUP EXISTING DATA ────────────────────────────────────
  console.log('🧹 Purging old data for a fresh clean state...');
  await prisma.activityLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.dispatchItem.deleteMany({});
  await prisma.dispatch.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.invoiceSequence.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.warehouseStock.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.dealerCategoryDiscount.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.systemSetting.deleteMany({});
  console.log('🧹 Database clean.');

  // ─── 1. WAREHOUSES (2) ───────────────────────────────────────────
  console.log('\n--- 1. Seeding Warehouses ---');
  const mumbaiWarehouse = await prisma.warehouse.create({
    data: {
      name: 'Mumbai Primary Hub',
      code: 'WH-MUM-01',
      address: 'Plot 42, MIDC Industrial Area, Andheri East',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400093',
      contactPerson: 'Rajesh Sharma',
      contactPhone: '+91 98111 22233',
      isPrimary: true,
    },
  });

  const delhiWarehouse = await prisma.warehouse.create({
    data: {
      name: 'Delhi Distribution Center',
      code: 'WH-DEL-01',
      address: 'Phase II, Okhla Industrial Area',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110020',
      contactPerson: 'Amit Verma',
      contactPhone: '+91 98222 33344',
      isPrimary: false,
    },
  });

  console.log(`✅ Seeded Warehouses: ${mumbaiWarehouse.name} (${mumbaiWarehouse.code}), ${delhiWarehouse.name} (${delhiWarehouse.code})`);

  // ─── 2. USERS (1 Admin + 3 Approved Dealers + 1 Pending + 1 Rejected) ─────
  console.log('\n--- 2. Seeding Users ---');
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const dealerPassword = await bcrypt.hash('Dealer@123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@nextrade.com',
      password: adminPassword,
      name: 'NexTrade Administrator',
      phone: '+91 98765 43210',
      role: UserRole.ADMIN,
      status: UserStatus.APPROVED,
    },
  });

  // Dealer 1: Apex Hardware Solutions
  const dealerApex = await prisma.user.create({
    data: {
      email: 'apex@nextrade.com',
      password: dealerPassword,
      name: 'Vikram Mehta',
      businessName: 'Apex Hardware Solutions',
      businessAddress: '124, M.G. Road, Pune, Maharashtra - 411001',
      phone: '+91 98200 11111',
      gstNumber: '27AABCA1234A1Z5',
      role: UserRole.DEALER,
      status: UserStatus.APPROVED,
      creditLimit: 500000,
      creditDays: 45,
      remainingCreditLimit: 500000,
      assignedWarehouseId: mumbaiWarehouse.id,
    },
  });

  // Dealer 2: BuildMart Industries
  const dealerBuildMart = await prisma.user.create({
    data: {
      email: 'buildmart@nextrade.com',
      password: dealerPassword,
      name: 'Rohan Gupta',
      businessName: 'BuildMart Industries',
      businessAddress: 'Plot 88, Sector 18, Gurugram, Haryana - 122015',
      phone: '+91 98200 22222',
      gstNumber: '07AABCB2345B1Z4',
      role: UserRole.DEALER,
      status: UserStatus.APPROVED,
      creditLimit: 300000,
      creditDays: 30,
      remainingCreditLimit: 300000,
      assignedWarehouseId: delhiWarehouse.id,
    },
  });

  // Dealer 3: ProFix Traders
  const dealerProFix = await prisma.user.create({
    data: {
      email: 'profix@nextrade.com',
      password: dealerPassword,
      name: 'Sunil Deshmukh',
      businessName: 'ProFix Traders',
      businessAddress: 'Shop 12, Industrial Estate, Thane West, Maharashtra - 400604',
      phone: '+91 98200 33333',
      gstNumber: '27AABCP3456C1Z3',
      role: UserRole.DEALER,
      status: UserStatus.APPROVED,
      creditLimit: 200000,
      creditDays: 30,
      remainingCreditLimit: 200000,
      assignedWarehouseId: mumbaiWarehouse.id,
    },
  });

  // Pending Dealer
  const dealerPending = await prisma.user.create({
    data: {
      email: 'pending@nextrade.com',
      password: dealerPassword,
      name: 'Aakash Patel',
      businessName: 'Aakash Fasteners & Tools',
      businessAddress: 'GIDC Estate, Vatva, Ahmedabad, Gujarat - 382445',
      phone: '+91 98200 44444',
      gstNumber: '24AABCP4567D1Z2',
      role: UserRole.DEALER,
      status: UserStatus.PENDING,
    },
  });

  // Rejected Dealer
  const dealerRejected = await prisma.user.create({
    data: {
      email: 'rejected@nextrade.com',
      password: dealerPassword,
      name: 'Karan Malhotra',
      businessName: 'Malhotra Spares Corp',
      businessAddress: 'Chandni Chowk, Delhi - 110006',
      phone: '+91 98200 55555',
      gstNumber: '07AABCM5678E1Z1',
      role: UserRole.DEALER,
      status: UserStatus.REJECTED,
      rejectionReason: 'Invalid GST documentation and expired trade license',
    },
  });

  console.log(`✅ Seeded 6 Users (1 Admin, 3 Approved Dealers, 1 Pending, 1 Rejected)`);

  // ─── 3. CATEGORIES (3-level hierarchy, 2 trees) ──────────────────
  console.log('\n--- 3. Seeding Categories (3 Levels) ---');
  // Tree 1: Industrial Hardware
  const catTree1 = await prisma.category.create({
    data: { name: 'Industrial Hardware', slug: 'industrial-hardware', level: 1 },
  });
  const catFasteners = await prisma.category.create({
    data: { name: 'Fasteners & Fixings', slug: 'fasteners-fixings', level: 2, parentId: catTree1.id },
  });
  const catHexBolts = await prisma.category.create({
    data: { name: 'Hex Bolts & Nuts', slug: 'hex-bolts-nuts', level: 3, parentId: catFasteners.id },
  });
  const catScrews = await prisma.category.create({
    data: { name: 'Self-Drilling Screws', slug: 'self-drilling-screws', level: 3, parentId: catFasteners.id },
  });

  // Tree 2: Power Tools
  const catTree2 = await prisma.category.create({
    data: { name: 'Power Tools', slug: 'power-tools', level: 1 },
  });
  const catCutting = await prisma.category.create({
    data: { name: 'Cutting Tools', slug: 'cutting-tools', level: 2, parentId: catTree2.id },
  });
  const catDiscs = await prisma.category.create({
    data: { name: 'Angle Grinder Discs', slug: 'angle-grinder-discs', level: 3, parentId: catCutting.id },
  });
  const catDrillBits = await prisma.category.create({
    data: { name: 'Drill Bits', slug: 'drill-bits', level: 3, parentId: catCutting.id },
  });

  console.log('✅ Seeded Category Hierarchy: 2 Root, 2 Subcategories, 4 Leaf categories');

  // ─── 4. BRANDS (3) ───────────────────────────────────────────────
  console.log('\n--- 4. Seeding Brands ---');
  const brandUltraFasten = await prisma.brand.create({
    data: { name: 'UltraFasten Pro', slug: 'ultrafasten-pro' },
  });
  const brandPowerCut = await prisma.brand.create({
    data: { name: 'PowerCut Industries', slug: 'powercut-industries' },
  });
  const brandSteelGrip = await prisma.brand.create({
    data: { name: 'SteelGrip Tools', slug: 'steelgrip-tools' },
  });

  console.log('✅ Seeded 3 Brands (UltraFasten Pro, PowerCut Industries, SteelGrip Tools)');

  // ─── 5. DEALER CATEGORY DISCOUNTS ────────────────────────────────
  console.log('\n--- 5. Seeding Dealer Category Discounts ---');
  // Apex Hardware: 15% on Hex Bolts, 10% on Screws
  await prisma.dealerCategoryDiscount.createMany({
    data: [
      { dealerId: dealerApex.id, categoryId: catHexBolts.id, discountPercentage: 15.0 },
      { dealerId: dealerApex.id, categoryId: catScrews.id, discountPercentage: 10.0 },
      // BuildMart: 12% on all Fasteners categories
      { dealerId: dealerBuildMart.id, categoryId: catHexBolts.id, discountPercentage: 12.0 },
      { dealerId: dealerBuildMart.id, categoryId: catScrews.id, discountPercentage: 12.0 },
      // ProFix: 8% on Power Tools categories
      { dealerId: dealerProFix.id, categoryId: catDiscs.id, discountPercentage: 8.0 },
      { dealerId: dealerProFix.id, categoryId: catDrillBits.id, discountPercentage: 8.0 },
    ],
  });
  console.log('✅ Seeded Category Discounts for all 3 dealers');

  // ─── 6. PRODUCTS & VARIANTS (8 Products) ─────────────────────────
  console.log('\n--- 6. Seeding Products & Variants ---');

  // Product 1: M8 Hex Bolt Zinc Plated
  const prod1 = await prisma.product.create({
    data: {
      name: 'M8 Hex Bolt Zinc Plated',
      slug: 'm8-hex-bolt-zinc-plated',
      sku: 'NEX-HEX-00001',
      categoryId: catHexBolts.id,
      brandId: brandUltraFasten.id,
      description: 'High quality electro-galvanized grade 4.6 hex bolts for structural assembly.',
      images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80'],
      variants: {
        create: [
          {
            name: 'M8 x 30mm Zinc Plated',
            sku: 'NEX-HEX-00001-V1',
            price: 15.0,
            costPrice: 10.5,
            gstPercentage: 18.0,
            packingDetails: 'Box of 100 pcs',
          },
          {
            name: 'M8 x 50mm Zinc Plated',
            sku: 'NEX-HEX-00001-V2',
            price: 22.0,
            costPrice: 15.4,
            gstPercentage: 18.0,
            packingDetails: 'Box of 100 pcs',
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 2: M10 Hex Nut Stainless Steel
  const prod2 = await prisma.product.create({
    data: {
      name: 'M10 Hex Nut Stainless Steel',
      slug: 'm10-hex-nut-stainless-steel',
      sku: 'NEX-HEX-00002',
      categoryId: catHexBolts.id,
      brandId: brandUltraFasten.id,
      description: 'Corrosion resistant SS 304 austenitic stainless steel hexagonal nut.',
      images: ['https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=600&q=80'],
      variants: {
        create: [
          {
            name: 'M10 SS 304 Hex Nut',
            sku: 'NEX-HEX-00002-V1',
            price: 12.0,
            costPrice: 8.4,
            gstPercentage: 18.0,
            packingDetails: 'Box of 200 pcs',
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 3: M12 Hex Bolt High Tensile
  const prod3 = await prisma.product.create({
    data: {
      name: 'M12 Hex Bolt High Tensile',
      slug: 'm12-hex-bolt-high-tensile',
      sku: 'NEX-HEX-00003',
      categoryId: catHexBolts.id,
      brandId: brandUltraFasten.id,
      description: 'Grade 8.8 medium carbon steel high-strength bolt for heavy equipment mounting.',
      images: ['https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80'],
      variants: {
        create: [
          {
            name: 'M12 x 40mm Grade 8.8',
            sku: 'NEX-HEX-00003-V1',
            price: 35.0,
            costPrice: 24.5,
            gstPercentage: 18.0,
            packingDetails: 'Box of 50 pcs',
          },
          {
            name: 'M12 x 60mm Grade 8.8',
            sku: 'NEX-HEX-00003-V2',
            price: 48.0,
            costPrice: 33.6,
            gstPercentage: 18.0,
            packingDetails: 'Box of 50 pcs',
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 4: Self-Drilling Screw 8G
  const prod4 = await prisma.product.create({
    data: {
      name: 'Self-Drilling Screw 8G',
      slug: 'self-drilling-screw-8g',
      sku: 'NEX-SCR-00001',
      categoryId: catScrews.id,
      brandId: brandSteelGrip.id,
      description: 'Tek screw with hardened drill point for metal-to-metal and roofing fixing.',
      images: ['https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=600&q=80'],
      variants: {
        create: [
          {
            name: '8G x 25mm Hex Head',
            sku: 'NEX-SCR-00001-V1',
            price: 4.0,
            costPrice: 2.8,
            gstPercentage: 18.0,
            packingDetails: 'Pouch of 500 pcs',
          },
          {
            name: '8G x 38mm Hex Head',
            sku: 'NEX-SCR-00001-V2',
            price: 6.0,
            costPrice: 4.2,
            gstPercentage: 18.0,
            packingDetails: 'Pouch of 500 pcs',
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 5: 4.5 inch Cut-Off Wheel
  const prod5 = await prisma.product.create({
    data: {
      name: '4.5 inch Cut-Off Wheel',
      slug: '4-5-inch-cut-off-wheel',
      sku: 'NEX-DIS-00001',
      categoryId: catDiscs.id,
      brandId: brandPowerCut.id,
      description: 'Reinforced abrasive cutting wheel for stainless steel and ferrous metals.',
      images: ['https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=600&q=80'],
      variants: {
        create: [
          {
            name: '115mm x 1.0mm Thin Inox Disc',
            sku: 'NEX-DIS-00001-V1',
            price: 45.0,
            costPrice: 31.5,
            gstPercentage: 18.0,
            packingDetails: 'Pack of 25 pcs',
          },
          {
            name: '115mm x 2.0mm Heavy Duty Disc',
            sku: 'NEX-DIS-00001-V2',
            price: 60.0,
            costPrice: 42.0,
            gstPercentage: 18.0,
            packingDetails: 'Pack of 25 pcs',
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 6: 4.5 inch Flap Disc
  const prod6 = await prisma.product.create({
    data: {
      name: '4.5 inch Flap Disc',
      slug: '4-5-inch-flap-disc',
      sku: 'NEX-DIS-00002',
      categoryId: catDiscs.id,
      brandId: brandPowerCut.id,
      description: 'Zirconia alumina abrasive grain on heavy cloth backing for metal grinding.',
      images: ['https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80'],
      variants: {
        create: [
          {
            name: '115mm Grit 60 Zirconia Flap Disc',
            sku: 'NEX-DIS-00002-V1',
            price: 120.0,
            costPrice: 84.0,
            gstPercentage: 18.0,
            packingDetails: 'Box of 10 pcs',
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 7: HSS Twist Drill Bit Set
  const prod7 = await prisma.product.create({
    data: {
      name: 'HSS Twist Drill Bit Set',
      slug: 'hss-twist-drill-bit-set',
      sku: 'NEX-BIT-00001',
      categoryId: catDrillBits.id,
      brandId: brandSteelGrip.id,
      description: 'High-speed steel ground drill bits suitable for alloyed and unalloyed steel.',
      images: ['https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80'],
      variants: {
        create: [
          {
            name: '5-Piece HSS Bit Set (2-6mm)',
            sku: 'NEX-BIT-00001-V1',
            price: 350.0,
            costPrice: 245.0,
            gstPercentage: 18.0,
            packingDetails: 'Metal cassette case',
          },
          {
            name: '10-Piece HSS Bit Set (1-10mm)',
            sku: 'NEX-BIT-00001-V2',
            price: 750.0,
            costPrice: 525.0,
            gstPercentage: 18.0,
            packingDetails: 'Metal index box',
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Product 8: Masonry Hammer Drill Bit
  const prod8 = await prisma.product.create({
    data: {
      name: 'Masonry Hammer Drill Bit',
      slug: 'masonry-hammer-drill-bit',
      sku: 'NEX-BIT-00002',
      categoryId: catDrillBits.id,
      brandId: brandSteelGrip.id,
      description: 'Tungsten carbide tipped hammer drill bit for concrete and masonry drilling.',
      images: ['https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=600&q=80'],
      variants: {
        create: [
          {
            name: '8mm x 160mm SDS Plus Masonry Bit',
            sku: 'NEX-BIT-00002-V1',
            price: 180.0,
            costPrice: 126.0,
            gstPercentage: 18.0,
            packingDetails: 'Single blister pack',
          },
        ],
      },
    },
    include: { variants: true },
  });

  const allVariants = [
    ...prod1.variants,
    ...prod2.variants,
    ...prod3.variants,
    ...prod4.variants,
    ...prod5.variants,
    ...prod6.variants,
    ...prod7.variants,
    ...prod8.variants,
  ];

  console.log(`✅ Seeded 8 Products with ${allVariants.length} Variants`);

  // ─── 7. INVENTORY (WarehouseStock per warehouse per variant) ───────
  console.log('\n--- 7. Seeding Inventory (Mumbai & Delhi) ---');

  // Let's create realistic stocks:
  // Mumbai gets 60% of stock, Delhi gets 40%
  // Items 0 and 5 have low stock in Delhi/Mumbai to trigger low stock alerts (< reorderPoint)
  for (let i = 0; i < allVariants.length; i++) {
    const v = allVariants[i];

    // Low stock trigger on variant 1 (M8 x 50mm) and variant 6 (115mm Inox Disc)
    const isLowStockMumbai = i === 1;
    const isLowStockDelhi = i === 6;

    const qtyMum = isLowStockMumbai ? 4 : Math.floor(150 + (i * 25));
    const qtyDel = isLowStockDelhi ? 3 : Math.floor(100 + (i * 15));

    await prisma.warehouseStock.createMany({
      data: [
        {
          warehouseId: mumbaiWarehouse.id,
          productVariantId: v.id,
          quantity: qtyMum,
          reservedQuantity: 0,
          reorderPoint: 15,
        },
        {
          warehouseId: delhiWarehouse.id,
          productVariantId: v.id,
          quantity: qtyDel,
          reservedQuantity: 0,
          reorderPoint: 10,
        },
      ],
    });
  }

  console.log(`✅ Seeded WarehouseStock records across Mumbai and Delhi (with low stock alerts configured)`);

  // ─── 8. ORDERS, DISPATCHES, INVOICES, PAYMENTS (15 Orders) ────────
  console.log('\n--- 8. Seeding 15 Orders Across Lifecycle Stages ---');

  const dealers = [dealerApex, dealerBuildMart, dealerProFix];
  const now = new Date();
  const fy = getIndianFinancialYear(now);
  let invoiceCounterMumbai = 1;
  let invoiceCounterDelhi = 1;

  // Helper for generating order items
  const buildItems = (dealerId: string, varList: typeof allVariants, quantities: number[]) => {
    let subtotal = 0;
    let totalGST = 0;
    const itemsData = [];

    for (let idx = 0; idx < varList.length; idx++) {
      const variant = varList[idx];
      const qty = quantities[idx];
      const basePrice = Number(variant.price);

      // Determine discount %
      let discPct = 0;
      if (dealerId === dealerApex.id) {
        if (variant.sku.startsWith('NEX-HEX')) discPct = 15;
        else if (variant.sku.startsWith('NEX-SCR')) discPct = 10;
      } else if (dealerId === dealerBuildMart.id) {
        if (variant.sku.startsWith('NEX-HEX') || variant.sku.startsWith('NEX-SCR')) discPct = 12;
      } else if (dealerId === dealerProFix.id) {
        if (variant.sku.startsWith('NEX-DIS') || variant.sku.startsWith('NEX-BIT')) discPct = 8;
      }

      const unitPrice = Number((basePrice * (1 - discPct / 100)).toFixed(2));
      const lineTaxable = Number((unitPrice * qty).toFixed(2));
      const lineGST = Number((lineTaxable * 0.18).toFixed(2));

      subtotal += lineTaxable;
      totalGST += lineGST;

      itemsData.push({
        productVariantId: variant.id,
        quantity: qty,
        originalUnitPrice: basePrice,
        unitPrice,
        dealerDiscount: discPct,
        gstPercentage: 18.0,
        gstAmount: lineGST,
        total: lineTaxable,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    totalGST = Number(totalGST.toFixed(2));
    const grandTotal = Number((subtotal + totalGST).toFixed(2));

    return { itemsData, subtotal, totalGST, grandTotal };
  };

  // We will create:
  // 5 DELIVERED
  // 3 DISPATCHED
  // 2 PROCESSING
  // 2 CONFIRMED
  // 2 PENDING
  // 1 CANCELLED
  // Total = 15 orders!

  const orderSpecs: Array<{
    status: OrderStatus;
    dealerIdx: number;
    whIdx: number; // 0: Mumbai, 1: Delhi
    variants: typeof allVariants;
    quantities: number[];
    daysAgo: number;
    creditDays?: number; // overrides the dealer default for this order
  }> = [
    // 5 DELIVERED
    { status: OrderStatus.DELIVERED, dealerIdx: 0, whIdx: 0, variants: [allVariants[0], allVariants[3]], quantities: [20, 10], daysAgo: 25 },
    { status: OrderStatus.DELIVERED, dealerIdx: 1, whIdx: 1, variants: [allVariants[1], allVariants[4]], quantities: [30, 15], daysAgo: 20 },
    { status: OrderStatus.DELIVERED, dealerIdx: 2, whIdx: 0, variants: [allVariants[6], allVariants[9]], quantities: [10, 5], daysAgo: 15 },
    { status: OrderStatus.DELIVERED, dealerIdx: 0, whIdx: 0, variants: [allVariants[2], allVariants[7]], quantities: [25, 8], daysAgo: 40, creditDays: 15 },
    { status: OrderStatus.DELIVERED, dealerIdx: 1, whIdx: 1, variants: [allVariants[5], allVariants[8]], quantities: [15, 6], daysAgo: 5 },

    // 3 DISPATCHED
    { status: OrderStatus.DISPATCHED, dealerIdx: 2, whIdx: 0, variants: [allVariants[0], allVariants[6]], quantities: [15, 10], daysAgo: 4 },
    { status: OrderStatus.DISPATCHED, dealerIdx: 0, whIdx: 0, variants: [allVariants[3], allVariants[7]], quantities: [40, 5], daysAgo: 3 },
    { status: OrderStatus.DISPATCHED, dealerIdx: 1, whIdx: 1, variants: [allVariants[2], allVariants[4]], quantities: [20, 25], daysAgo: 2 },

    // 2 PROCESSING
    { status: OrderStatus.PROCESSING, dealerIdx: 0, whIdx: 0, variants: [allVariants[1], allVariants[5]], quantities: [50, 12], daysAgo: 2 },
    { status: OrderStatus.PROCESSING, dealerIdx: 2, whIdx: 0, variants: [allVariants[8], allVariants[9]], quantities: [4, 6], daysAgo: 1 },

    // 2 CONFIRMED
    { status: OrderStatus.CONFIRMED, dealerIdx: 1, whIdx: 1, variants: [allVariants[0], allVariants[4]], quantities: [25, 20], daysAgo: 1 },
    { status: OrderStatus.CONFIRMED, dealerIdx: 2, whIdx: 0, variants: [allVariants[6], allVariants[7]], quantities: [12, 10], daysAgo: 1 },

    // 2 PENDING
    { status: OrderStatus.PENDING, dealerIdx: 0, whIdx: 0, variants: [allVariants[2], allVariants[3]], quantities: [30, 20], daysAgo: 0 },
    { status: OrderStatus.PENDING, dealerIdx: 1, whIdx: 1, variants: [allVariants[5], allVariants[9]], quantities: [10, 8], daysAgo: 0 },

    // 1 CANCELLED
    { status: OrderStatus.CANCELLED, dealerIdx: 2, whIdx: 0, variants: [allVariants[1], allVariants[8]], quantities: [15, 5], daysAgo: 12 },
  ];

  let orderCount = 0;
  let dispatchCount = 0;
  let invoiceCount = 0;
  let paymentCount = 0;

  for (let i = 0; i < orderSpecs.length; i++) {
    const spec = orderSpecs[i];
    const dealer = dealers[spec.dealerIdx];
    const warehouse = spec.whIdx === 0 ? mumbaiWarehouse : delhiWarehouse;
    const { itemsData, subtotal, totalGST, grandTotal } = buildItems(dealer.id, spec.variants, spec.quantities);

    const orderDate = new Date(now.getTime() - spec.daysAgo * 24 * 60 * 60 * 1000);
    const orderNumber = `ORD-2609${String(i + 1).padStart(2, '0')}-${String(1001 + i)}`;

    // Invoice allocation for DISPATCHED & DELIVERED
    let invoiceNumber: string | null = null;
    if (spec.status === OrderStatus.DISPATCHED || spec.status === OrderStatus.DELIVERED) {
      if (warehouse.code === 'WH-MUM-01') {
        invoiceNumber = `INV-MUM-${fy}-${String(invoiceCounterMumbai++).padStart(5, '0')}`;
      } else {
        invoiceNumber = `INV-DEL-${fy}-${String(invoiceCounterDelhi++).padStart(5, '0')}`;
      }
      invoiceCount++;
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        dealerId: dealer.id,
        warehouseId: warehouse.id,
        status: spec.status,
        subtotal,
        discount: 0,
        totalGST,
        grandTotal,
        invoiceNumber,
        creditDaysForOrder: spec.creditDays ?? (dealer.creditDays || 30),
        createdAt: orderDate,
        updatedAt: orderDate,
        shippingAddress: {
          name: dealer.businessName || dealer.name,
          phone: dealer.phone,
          address: dealer.businessAddress || 'Plot 10, Industrial Hub',
          city: '',
          state: '',
          pincode: '',
        },
        items: {
          create: itemsData,
        },
      },
      include: { items: true },
    });
    orderCount++;

    // DISPATCH CREATION for DISPATCHED / DELIVERED / PROCESSING
    if (spec.status === OrderStatus.DELIVERED || spec.status === OrderStatus.DISPATCHED) {
      const dspNum = `DSP-2609${String(i + 1).padStart(2, '0')}-${String(101 + i)}`;
      const isDelivered = spec.status === OrderStatus.DELIVERED;

      const dsp = await prisma.dispatch.create({
        data: {
          dispatchNumber: dspNum,
          orderId: order.id,
          warehouseId: warehouse.id,
          status: isDelivered ? DispatchStatus.DELIVERED : DispatchStatus.IN_TRANSIT,
          courierName: i % 2 === 0 ? 'Blue Dart Express' : 'Delhivery Freight',
          trackingNumber: `AWB${Date.now().toString().slice(-6)}${i}IN`,
          dispatchedAt: orderDate,
          deliveredAt: isDelivered ? new Date(orderDate.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
          items: {
            create: order.items.map((it) => ({
              orderItemId: it.id,
              productVariantId: it.productVariantId,
              quantity: it.quantity,
            })),
          },
        },
      });
      dispatchCount++;

      // StockMovement records
      for (const item of order.items) {
        await prisma.stockMovement.create({
          data: {
            warehouseId: warehouse.id,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            type: StockMovementType.OUT,
            referenceType: 'DISPATCH',
            referenceId: dsp.dispatchNumber,
            performedById: admin.id,
            notes: `Dispatched order #${order.orderNumber}`,
            createdAt: orderDate,
          },
        });
      }
    } else if (spec.status === OrderStatus.PROCESSING) {
      // Partial dispatch: dispatch only the first item of the order
      const firstItem = order.items[0];
      const dspNum = `DSP-2609${String(i + 1).padStart(2, '0')}-${String(101 + i)}`;

      await prisma.dispatch.create({
        data: {
          dispatchNumber: dspNum,
          orderId: order.id,
          warehouseId: warehouse.id,
          status: DispatchStatus.IN_TRANSIT,
          courierName: 'V-Trans Logistics',
          trackingNumber: `VT${Date.now().toString().slice(-6)}${i}IN`,
          dispatchedAt: orderDate,
          items: {
            create: [
              {
                orderItemId: firstItem.id,
                productVariantId: firstItem.productVariantId,
                quantity: Math.floor(firstItem.quantity / 2) || 1,
              },
            ],
          },
        },
      });
      dispatchCount++;
    }

    // PAYMENTS: 3 VERIFIED payments for first 3 DELIVERED orders, 2 PENDING payments
    if (i < 3 && spec.status === OrderStatus.DELIVERED) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          dealerId: dealer.id,
          amount: order.grandTotal,
          paymentMethod: 'BANK_TRANSFER',
          referenceId: `UTR${Date.now().toString().slice(-8)}${i}`,
          status: PaymentStatus.PAID,
          verifiedAt: new Date(orderDate.getTime() + 3 * 24 * 60 * 60 * 1000),
          notes: 'RTGS payment received and verified against bank statement',
          createdAt: orderDate,
        },
      });
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.PAID } });
      paymentCount++;
    } else if (i === 3 || i === 4) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          dealerId: dealer.id,
          amount: order.grandTotal,
          paymentMethod: 'NEFT',
          referenceId: `NEFT${Date.now().toString().slice(-8)}${i}`,
          status: PaymentStatus.PENDING,
          notes: 'Cheque deposit slip uploaded, awaiting clearance',
          createdAt: orderDate,
        },
      });
      paymentCount++;
    }
  }

  // Update InvoiceSequence records
  await prisma.invoiceSequence.upsert({
    where: { warehouseId_periodKey: { warehouseId: mumbaiWarehouse.id, periodKey: fy } },
    create: { warehouseId: mumbaiWarehouse.id, periodKey: fy, lastNumber: invoiceCounterMumbai - 1 },
    update: { lastNumber: invoiceCounterMumbai - 1 },
  });

  await prisma.invoiceSequence.upsert({
    where: { warehouseId_periodKey: { warehouseId: delhiWarehouse.id, periodKey: fy } },
    create: { warehouseId: delhiWarehouse.id, periodKey: fy, lastNumber: invoiceCounterDelhi - 1 },
    update: { lastNumber: invoiceCounterDelhi - 1 },
  });

  console.log(`✅ Seeded ${orderCount} Orders, ${dispatchCount} Dispatches, ${invoiceCount} Invoices, ${paymentCount} Payments`);

  // ─── 8. SYNCHRONIZE DEALER REMAINING CREDIT LIMITS ──────────────
  for (const d of [dealerApex, dealerBuildMart, dealerProFix]) {
    const nonCancelledOrders = await prisma.order.findMany({
      where: {
        dealerId: d.id,
        status: { not: OrderStatus.CANCELLED },
      },
      select: { grandTotal: true },
    });
    const totalOrdered = nonCancelledOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const limit = Number(d.creditLimit || 0);
    const remaining = Math.max(0, Number((limit - totalOrdered).toFixed(2)));
    await prisma.user.update({
      where: { id: d.id },
      data: { remainingCreditLimit: remaining },
    });
  }
  console.log('✅ Synchronized dealers remainingCreditLimit with sum of non-cancelled order totals');

  // ─── 9. SETTINGS INITIALIZATION ─────────────────────────────────
  console.log('\n--- 9. Seeding System Settings ---');

  await prisma.systemSetting.createMany({
    data: [
      {
        key: 'COMPANY_INFO',
        description: 'Corporate business profile and tax details',
        value: {
          name: 'NexTrade Industrial Technologies',
          address: '401 Trade Avenue, Kurla West',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400070',
          phone: '+91 98200 12345',
          email: 'contact@nextrade.com',
          website: 'https://www.nextrade.com',
          gstNumber: '00AAAAA0000A0Z0',
          logo: 'https://placehold.co/200x60?text=NexTrade',
        },
      },
      {
        key: 'INVOICE_SETTINGS',
        description: 'Invoice defaults and settlement bank details',
        value: {
          defaultCreditDays: 30,
          dueDateBuffer: 0,
          bankName: 'Demo Bank',
          accountNumber: '00000000000000',
          ifscCode: 'DEMO0000001',
          accountHolderName: 'NexTrade Industrial Technologies',
          upiId: 'demo@nextradetest',
        },
      },
      {
        key: 'INVENTORY_SETTINGS',
        description: 'Inventory thresholds and stock safety policies',
        value: {
          defaultReorderPoint: 10,
          defaultLowStockThreshold: 5,
          allowNegativeStock: false,
        },
      },
      {
        key: 'NOTIFICATION_SETTINGS',
        description: 'System alert triggers and email preferences',
        value: {
          lowStockEmailEnabled: true,
          orderConfirmationEnabled: true,
          paymentReminderEnabled: true,
        },
      },
    ],
  });

  console.log('✅ Seeded System Settings with corporate company profile');

  // ─── 10. ACTIVITY LOGS ──────────────────────────────────────────
  console.log('\n--- 10. Seeding Activity Logs ---');
  await prisma.activityLog.createMany({
    data: [
      {
        userId: admin.id,
        action: 'INITIALIZE_SETTINGS',
        entityType: 'SETTING',
        details: { initializedBy: 'Seed Script' },
      },
      {
        userId: admin.id,
        action: 'APPROVE',
        entityType: 'DEALER',
        entityId: dealerApex.id,
        details: { dealer: dealerApex.businessName, creditLimit: 500000 },
      },
      {
        userId: admin.id,
        action: 'APPROVE',
        entityType: 'DEALER',
        entityId: dealerBuildMart.id,
        details: { dealer: dealerBuildMart.businessName, creditLimit: 300000 },
      },
      {
        userId: admin.id,
        action: 'APPROVE',
        entityType: 'DEALER',
        entityId: dealerProFix.id,
        details: { dealer: dealerProFix.businessName, creditLimit: 200000 },
      },
      {
        userId: admin.id,
        action: 'REJECT',
        entityType: 'DEALER',
        entityId: dealerRejected.id,
        details: { dealer: dealerRejected.businessName, reason: dealerRejected.rejectionReason },
      },
      {
        userId: admin.id,
        action: 'STOCK_ADJUSTMENT',
        entityType: 'INVENTORY',
        entityId: mumbaiWarehouse.id,
        details: { warehouse: mumbaiWarehouse.name, reason: 'Initial inventory intake' },
      },
    ],
  });

  console.log('✅ Seeded Audit Activity Logs');

  // ─── 11. FINAL COUNTS REPORT ────────────────────────────────────
  console.log('\n==============================================');
  console.log('🎉 SEEDING COMPLETE! SUMMARY COUNTS:');
  console.log('==============================================');

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

  console.log(`Users:         ${totalUsers} (1 Admin + 5 Dealers)`);
  console.log(`Dealers:       ${totalDealers} (3 Approved, 1 Pending, 1 Rejected)`);
  console.log(`Warehouses:    ${totalWarehouses} (Mumbai Primary Hub + Delhi Distribution Center)`);
  console.log(`Products:      ${totalProducts}`);
  console.log(`Variants:      ${totalVariants}`);
  console.log(`Orders:        ${totalOrders}`);
  console.log(`Dispatches:    ${totalDispatches}`);
  console.log(`Invoices:      ${totalInvoices}`);
  console.log(`Payments:      ${totalPayments} (3 Verified, 2 Pending)`);
  console.log(`ActivityLogs:  ${totalActivityLogs}`);
  console.log('==============================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
