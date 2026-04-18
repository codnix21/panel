import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

router.get('/export.csv', async (req: AuthRequest, res: Response) => {
  try {
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let p = 1;
    if (action) {
      conditions.push(`action = $${p++}`);
      params.push(action);
    }
    if (from) {
      conditions.push(`created_at >= $${p++}::timestamptz`);
      params.push(from);
    }
    if (to) {
      conditions.push(`created_at <= $${p++}::timestamptz`);
      params.push(to);
    }
    const where = conditions.join(' AND ');

    const result = await pool.query(
      `SELECT id, user_id, username, action, resource_type, resource_id, details, ip, created_at
       FROM audit_log WHERE ${where} ORDER BY created_at DESC LIMIT 10000`,
      params
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');
    const lines = [
      'id,user_id,username,action,resource_type,resource_id,ip,created_at,details',
      ...result.rows.map((r) =>
        [
          r.id,
          r.user_id ?? '',
          r.username ?? '',
          r.action,
          r.resource_type ?? '',
          r.resource_id ?? '',
          r.ip ?? '',
          r.created_at,
          JSON.stringify(r.details ?? {}),
        ]
          .map(csvEscape)
          .join(',')
      ),
    ];
    res.send(lines.join('\n'));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let p = 1;
    if (action) {
      conditions.push(`action = $${p++}`);
      params.push(action);
    }
    if (from) {
      conditions.push(`created_at >= $${p++}::timestamptz`);
      params.push(from);
    }
    if (to) {
      conditions.push(`created_at <= $${p++}::timestamptz`);
      params.push(to);
    }
    const where = conditions.join(' AND ');

    const countResult = await pool.query(`SELECT COUNT(*)::int AS c FROM audit_log WHERE ${where}`, [...params]);
    const total = countResult.rows[0]?.c ?? 0;

    const listParams = [...params, limit, offset];
    const limIdx = p;
    const offIdx = p + 1;
    const result = await pool.query(
      `SELECT id, user_id, username, action, resource_type, resource_id, details, ip, created_at
       FROM audit_log WHERE ${where} ORDER BY created_at DESC LIMIT $${limIdx} OFFSET $${offIdx}`,
      listParams
    );
    res.json({ rows: result.rows, total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
