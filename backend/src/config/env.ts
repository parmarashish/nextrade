import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().default(7),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DEMO_MODE: z
    .preprocess((val) => val === 'true' || val === true || val === '1', z.boolean())
    .default(false),
  CRON_SECRET: z.string().optional(),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  if (
    result.data.NODE_ENV === 'production' &&
    [result.data.JWT_ACCESS_SECRET, result.data.JWT_REFRESH_SECRET].some((v) =>
      v.includes('CHANGE_THIS')
    )
  ) {
    console.error('❌ JWT secrets still contain the CHANGE_THIS placeholder. Set real secrets in production.');
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
