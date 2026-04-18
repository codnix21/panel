import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { auditReq } from '../middleware/auditHelpers';

const router = Router();

router.use(authMiddleware);

router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const r = await pool.query('SELECT id, name, preset, created_at FROM proxy_templates ORDER BY id DESC');
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, preset } = req.body as { name?: string; preset?: Record<string, unknown> };
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name required' });
      return;
    }
    const r = await pool.query(
      'INSERT INTO proxy_templates (name, preset) VALUES ($1, $2::jsonb) RETURNING id, name, preset, created_at',
      [name, JSON.stringify(preset || {})]
    );
    auditReq(req, 'template.create', 'template', String(r.rows[0].id), { name });
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const r = await pool.query('DELETE FROM proxy_templates WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    auditReq(req, 'template.delete', 'template', req.params.id, {});
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
