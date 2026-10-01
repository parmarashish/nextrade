import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './common/prisma.js';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 NexTrade API server running on port ${env.PORT} [${env.NODE_ENV}]`);
  console.log(`📡 Healthcheck available at http://localhost:${env.PORT}/health`);
});

// Graceful Shutdown
const handleShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('🔒 Closed HTTP server.');
    try {
      await prisma.$disconnect();
      console.log('📦 Disconnected from database.');
      process.exit(0);
    } catch (err) {
      console.error('Error during database disconnect:', err);
      process.exit(1);
    }
  });

  // Force shutdown if taking longer than 10 seconds
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
