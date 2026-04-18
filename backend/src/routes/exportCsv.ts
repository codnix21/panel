import { Router, Response } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getNodeWithToken, proxyToNode } from '../services/nodeProxyFetch';

const router = Router();

router.use(authMiddleware);

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

router.get('/nodes.csv', async (_req: AuthRequest, res: Response) => {
  try {
    const r = await pool.query(
      'SELECT id, name, ip, port, created_at, last_seen_at FROM nodes ORDER BY id'
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="nodes.csv"');
    const lines = [
      'id,name,ip,port,created_at,last_seen_at',
      ...r.rows.map((row) =>
        [row.id, row.name, row.ip, row.port, row.created_at, row.last_seen_at ?? '']
          .map(csvEscape)
          .join(',')
      ),
    ];
    res.send(lines.join('\n'));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/proxies.csv', async (_req: AuthRequest, res: Response) => {
  try {
    const nodesResult = await pool.query('SELECT * FROM nodes ORDER BY id');
    const metaResult = await pool.query('SELECT node_id, proxy_id, tags FROM proxy_meta');
    const tagMap = new Map<string, string>();
    for (const m of metaResult.rows) {
      tagMap.set(`${m.node_id}:${m.proxy_id}`, (m.tags || []).join(';'));
    }

    const rows: string[][] = [];
    for (const node of nodesResult.rows) {
      const n = await getNodeWithToken(String(node.id));
      if (!n) continue;
      try {
        const r = await proxyToNode(n, 'GET', '');
        if (r.status !== 200 || !Array.isArray(r.data)) continue;
        for (const p of r.data) {
          const tags = tagMap.get(`${node.id}:${p.id}`) || '';
          rows.push([
            String(node.id),
            node.name || '',
            node.ip || '',
            String(p.id),
            p.name || '',
            p.domain || '',
            p.status || '',
            p.note || '',
            tags,
          ]);
        }
      } catch {
        // skip offline
      }
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="proxies.csv"');
    const header =
      'node_id,node_name,node_ip,proxy_id,proxy_name,domain,status,note,tags';
    const lines = [
      header,
      ...rows.map((cols) => cols.map(csvEscape).join(',')),
    ];
    res.send(lines.join('\n'));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
