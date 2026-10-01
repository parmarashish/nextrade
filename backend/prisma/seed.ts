import { prisma } from '../src/common/prisma.js';
import { seedDatabase } from '../src/modules/system/reseed.service.js';

seedDatabase()
  .then((stats) => {
    console.log('\n==============================================');
    console.log('🎉 SEEDING COMPLETE! SUMMARY COUNTS:');
    console.log('==============================================');
    console.log(`Users:         ${stats.users}`);
    console.log(`Dealers:       ${stats.dealers}`);
    console.log(`Warehouses:    ${stats.warehouses}`);
    console.log(`Products:      ${stats.products}`);
    console.log(`Variants:      ${stats.variants}`);
    console.log(`Orders:        ${stats.orders}`);
    console.log(`Dispatches:    ${stats.dispatches}`);
    console.log(`Invoices:      ${stats.invoices}`);
    console.log(`Payments:      ${stats.payments}`);
    console.log(`ActivityLogs:  ${stats.activityLogs}`);
    console.log('==============================================\n');
  })
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
