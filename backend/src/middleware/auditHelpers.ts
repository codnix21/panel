import { AuthRequest } from './auth';
import { logAudit } from '../services/audit';
import { getClientIp } from '../utils/clientIp';

export function auditReq(
  req: AuthRequest,
  action: string,
  resourceType?: string | null,
  resourceId?: string | null,
  details?: Record<string, unknown> | null
): void {
  void logAudit({
    userId: req.user?.userId,
    username: req.user?.username,
    action,
    resourceType: resourceType ?? null,
    resourceId: resourceId ?? null,
    details: details ?? null,
    ip: getClientIp(req),
  });
}
