import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../common/app-error.js';
import { env } from '../config/env.js';

export const errorMiddleware = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      details,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
      ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    });
  }

  console.error('💥 Unhandled Exception:', err);

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(env.NODE_ENV === 'development' ? { stack: err.stack, error: err.message } : {}),
  });
};
