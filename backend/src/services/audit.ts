import { pool } from '../db';

export async function logAudit(params: {
  userId?: number | null;
  username?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, username, action, resource_type, resource_id, details, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.userId ?? null,
        params.username ?? null,
        params.action,
        params.resourceType ?? null,
        params.resourceId ?? null,
        params.details ?? null,
        params.ip ?? null,
      ]
    );
  } catch (e) {
    console.error('audit log failed:', e);
  }
}
