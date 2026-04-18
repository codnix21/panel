import { AuthRequest } from './auth';
export declare function auditReq(req: AuthRequest, action: string, resourceType?: string | null, resourceId?: string | null, details?: Record<string, unknown> | null): void;
