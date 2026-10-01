import { Request } from 'express';
import { UserRole, UserStatus } from '@prisma/client';

export interface AuthUserPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  assignedWarehouseId?: string | null;
  impersonatedBy?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
  sessionId?: string;
}

export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
