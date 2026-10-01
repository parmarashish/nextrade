import rateLimit from 'express-rate-limit';

// Strict rate limiter for authentication routes (login, register, refresh)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 failed auth attempts per windowMs
  skipSuccessfulRequests: true, // only failures count towards the brute-force limit
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

// Token refresh happens on every page load, so it gets its own, far more generous bucket
export const refreshRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please slow down.',
  },
});

// General rate limiter for general API endpoints
export const generalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please slow down.',
  },
});
