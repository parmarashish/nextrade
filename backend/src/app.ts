import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { generalRateLimiter } from './middleware/rate-limiter.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { authRoutes } from './auth/auth.routes.js';
import { categoryRoutes } from './modules/categories/categories.routes.js';
import { brandRoutes } from './modules/products/brands.routes.js';
import { productRoutes } from './modules/products/products.routes.js';
import { warehouseRoutes } from './modules/inventory/warehouses.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { dealerRoutes } from './modules/dealers/dealers.routes.js';
import { cartRoutes } from './modules/orders/cart.routes.js';
import { orderRoutes } from './modules/orders/orders.routes.js';
import { dispatchRoutes } from './modules/dispatch/dispatch.routes.js';
import { invoiceRoutes } from './modules/invoices/invoices.routes.js';
import { reportRoutes } from './modules/reports/reports.routes.js';
import { settingRoutes } from './modules/settings/settings.routes.js';
import { notificationRoutes } from './modules/notifications/notifications.routes.js';

const app = express();

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  })
);

// Strict CORS
app.use(
  cors({
    origin:
      env.NODE_ENV === 'production'
        ? [env.CORS_ORIGIN]
        : [env.CORS_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Request Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Apply General Rate Limiter to API routes
app.use('/api', generalRateLimiter);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'NexTrade B2B API',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/products', productRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dealers', dealerRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/notifications', notificationRoutes);

// Global 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} not found`,
  });
});

// Global Error Handler
app.use(errorMiddleware);

export default app;
