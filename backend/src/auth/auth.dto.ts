import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
  }),
});

export const dealerRegisterSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    phone: z.string().regex(/^\+?[0-9]{10,13}$/, 'Please enter a valid 10-digit phone number'),
    businessName: z.string().min(2, 'Business / Company name is required'),
    businessAddress: z.string().min(5, 'Business address is required'),
    gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST format (e.g. 27AAAAA0000A1Z5)').optional().or(z.literal('')),
  }),
});

export const impersonateSchema = z.object({
  body: z.object({
    dealerId: z.string().uuid('Invalid dealer ID format'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>['body'];
export type DealerRegisterInput = z.infer<typeof dealerRegisterSchema>['body'];
export type ImpersonateInput = z.infer<typeof impersonateSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
