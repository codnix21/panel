import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { getNodeWithToken, proxyToNode } from '../services/nodeProxyFetch';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const raw = String(req.query.q || '').trim();
    const q = raw.toLowerCase();
    if (!q || q.length < 2) {
      res.json({ nodes: [], proxies: [] });
      return;
    }
    const nodes = await pool.query(
      `SELECT id, name, ip, port, last_seen_at FROM nodes
       WHERE LOWER(name) LIKE $1 OR ip LIKE $1 OR CAST(id AS TEXT) = $2
       ORDER BY id LIMIT 25`,
      [`%${q}%`, raw]
    );
    const proxies: { nodeId: number; nodeName: string; proxy: Record<string, unknown> }[] = [];
    const metaRows = await pool.query('SELECT node_id, proxy_id, tags FROM proxy_meta');
    const tagStr = new Map<string, string>();
    for (const m of metaRows.rows) {
      tagStr.set(`${m.node_id}:${m.proxy_id}`, (m.tags || []).join(' '));
    }
    const allNodes = await pool.query('SELECT id, name, ip, port, token FROM nodes');
    for (const row of allNodes.rows) {
      const node = await getNodeWithToken(String(row.id));
      if (!node) continue;
      try {
        const r = await proxyToNode(node, 'GET', '');
        if (r.status !== 200 || !Array.isArray(r.data)) continue;
        for (const p of r.data) {
          const tags = tagStr.get(`${row.id}:${p.id}`) || '';
          const hay = `${p.id} ${p.name || ''} ${p.domain || ''} ${tags}`.toLowerCase();
          if (hay.includes(q)) {
            proxies.push({ nodeId: row.id, nodeName: row.name, proxy: p });
          }
        }
      } catch {
        // skip
      }
    }
    res.json({ nodes: nodes.rows, proxies: proxies.slice(0, 40) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
