import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { auditReq } from '../middleware/auditHelpers';
import { getNodeWithToken, proxyToNode } from '../services/nodeProxyFetch';
import { notifyAlert } from '../services/notify';

const router = Router();

router.use(authMiddleware);

// Batch: pause | unpause | restart
router.post('/:nodeId/proxies/batch', async (req: AuthRequest, res: Response) => {
  try {
    const { action, proxyIds } = req.body as { action?: string; proxyIds?: string[] };
    if (!action || !['pause', 'unpause', 'restart'].includes(action) || !Array.isArray(proxyIds)) {
      res.status(400).json({ error: 'action (pause|unpause|restart) and proxyIds[] required' });
      return;
    }
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const results: { id: string; ok: boolean; status: number; error?: string }[] = [];
    for (const pid of proxyIds) {
      const path = action === 'restart' ? `/${pid}/restart` : `/${pid}/${action}`;
      try {
        const r = await proxyToNode(node, 'POST', path);
        const ok = r.status >= 200 && r.status < 300;
        results.push({
          id: pid,
          ok,
          status: r.status,
          error: ok ? undefined : typeof r.data?.error === 'string' ? r.data.error : JSON.stringify(r.data),
        });
        if (ok) {
          auditReq(req, `proxy.batch_${action}`, 'proxy', pid, { nodeId: req.params.nodeId });
        }
      } catch (e: any) {
        results.push({ id: pid, ok: false, status: 0, error: e.message });
      }
    }
    const failed = results.filter((x) => !x.ok);
    if (failed.length > 0) {
      void notifyAlert(
        'Массовая операция: часть ошибок',
        `Нода ${req.params.nodeId}, ${action}, ошибок ${failed.length}/${results.length}. ID: ${failed.map((f) => f.id).join(', ')}`
      );
    }
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Batch SNI/domain update
router.post('/:nodeId/proxies/batch-domain', async (req: AuthRequest, res: Response) => {
  try {
    const { proxyIds, domain } = req.body as { proxyIds?: string[]; domain?: string };
    if (!Array.isArray(proxyIds) || !domain || typeof domain !== 'string') {
      res.status(400).json({ error: 'proxyIds[] and domain required' });
      return;
    }
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const pid of proxyIds) {
      const r = await proxyToNode(node, 'PUT', `/${pid}`, { domain });
      const ok = r.status >= 200 && r.status < 300;
      results.push({ id: pid, ok, error: ok ? undefined : JSON.stringify(r.data) });
      if (ok) auditReq(req, 'proxy.batch_domain', 'proxy', pid, { nodeId: req.params.nodeId, domain });
    }
    const failed = results.filter((x) => !x.ok);
    if (failed.length > 0) {
      void notifyAlert(
        'Смена SNI: часть ошибок',
        `Нода ${req.params.nodeId}, домен ${domain}, ошибок ${failed.length}/${results.length}. ID: ${failed.map((f) => f.id).join(', ')}`
      );
    }
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Clone proxy (same or another node)
router.post('/:nodeId/proxies/:proxyId/clone', async (req: AuthRequest, res: Response) => {
  try {
    const { targetNodeId, domain, name } = req.body as {
      targetNodeId?: number;
      domain?: string;
      name?: string;
    };
    const srcNode = await getNodeWithToken(req.params.nodeId);
    if (!srcNode) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const tgtId = targetNodeId != null ? String(targetNodeId) : req.params.nodeId;
    const tgtNode = await getNodeWithToken(tgtId);
    if (!tgtNode) {
      res.status(404).json({ error: 'Target node not found' });
      return;
    }
    const g = await proxyToNode(srcNode, 'GET', `/${req.params.proxyId}`);
    if (g.status !== 200) {
      res.status(g.status).json(g.data);
      return;
    }
    const p = g.data;
    const createBody = {
      name: name || `${p.name || 'Proxy'} (копия)`,
      note: p.note || '',
      maxConnections: p.maxConnections,
      listenPort: p.listenPort,
      vpnSubscription: p.vpnSubscription,
      domain: domain || undefined,
    };
    const c = await proxyToNode(tgtNode, 'POST', '', createBody);
    if (c.status >= 200 && c.status < 300 && c.data?.id) {
      auditReq(req, 'proxy.clone', 'proxy', String(c.data.id), {
        fromProxyId: req.params.proxyId,
        fromNodeId: req.params.nodeId,
        targetNodeId: tgtId,
      });
    }
    res.status(c.status).json(c.data);
  } catch (error: any) {
    res.status(502).json({ error: error.message });
  }
});

// Panel-only tags for a proxy
router.get('/:nodeId/proxies/:proxyId/panel-meta', async (req: AuthRequest, res: Response) => {
  try {
    const r = await pool.query('SELECT tags FROM proxy_meta WHERE node_id = $1 AND proxy_id = $2', [
      req.params.nodeId,
      req.params.proxyId,
    ]);
    res.json({ tags: r.rows[0]?.tags?.length ? r.rows[0].tags : [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:nodeId/proxies/:proxyId/panel-meta', async (req: AuthRequest, res: Response) => {
  try {
    const { tags } = req.body as { tags?: string[] };
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) {
      res.status(400).json({ error: 'tags must be string[]' });
      return;
    }
    await pool.query(
      `INSERT INTO proxy_meta (node_id, proxy_id, tags) VALUES ($1, $2, $3::text[])
       ON CONFLICT (node_id, proxy_id) DO UPDATE SET tags = EXCLUDED.tags`,
      [req.params.nodeId, req.params.proxyId, tags]
    );
    auditReq(req, 'proxy.tags_update', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
    res.json({ tags });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List proxies on a node
router.get('/:nodeId/proxies', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'GET', '');
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Create proxy on a node
router.post('/:nodeId/proxies', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'POST', '', req.body);
    if (result.status >= 200 && result.status < 300 && result.data?.id) {
      auditReq(req, 'proxy.create', 'proxy', String(result.data.id), { nodeId: req.params.nodeId });
    }
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Get proxy details
router.get('/:nodeId/proxies/:proxyId', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}`);
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Update proxy
router.put('/:nodeId/proxies/:proxyId', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'PUT', `/${req.params.proxyId}`, req.body);
    if (result.status >= 200 && result.status < 300) {
      auditReq(req, 'proxy.update', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
    }
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Delete proxy
router.delete('/:nodeId/proxies/:proxyId', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'DELETE', `/${req.params.proxyId}`);
    if (result.status >= 200 && result.status < 300) {
      auditReq(req, 'proxy.delete', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
    }
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Docker container inspect (proxy + xray)
router.get('/:nodeId/proxies/:proxyId/containers', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}/containers`);
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Get proxy container logs (proxied from node)
router.get('/:nodeId/proxies/:proxyId/logs', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const q = new URLSearchParams();
    if (req.query.target) q.set('target', String(req.query.target));
    if (req.query.tail) q.set('tail', String(req.query.tail));
    const qs = q.toString();
    const path = `/${req.params.proxyId}/logs${qs ? `?${qs}` : ''}`;
    const result = await proxyToNode(node, 'GET', path);
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Get proxy stats
router.get('/:nodeId/proxies/:proxyId/stats', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}/stats`);
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Get proxy link
router.get('/:nodeId/proxies/:proxyId/link', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}/link?server_ip=${node.ip}`);
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Pause proxy
router.post('/:nodeId/proxies/:proxyId/pause', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'POST', `/${req.params.proxyId}/pause`);
    if (result.status >= 200 && result.status < 300) {
      auditReq(req, 'proxy.pause', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
    }
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Unpause proxy
router.post('/:nodeId/proxies/:proxyId/unpause', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'POST', `/${req.params.proxyId}/unpause`);
    if (result.status >= 200 && result.status < 300) {
      auditReq(req, 'proxy.unpause', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
    }
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Get proxy stats history
router.get('/:nodeId/proxies/:proxyId/stats-history', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}/stats-history`);
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Get proxy IP history
router.get('/:nodeId/proxies/:proxyId/ip-history', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}/ip-history`);
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

// Clear proxy history
router.delete('/:nodeId/proxies/:proxyId/clear-history', async (req: AuthRequest, res: Response) => {
  try {
    const node = await getNodeWithToken(req.params.nodeId);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const result = await proxyToNode(node, 'DELETE', `/${req.params.proxyId}/clear-history`);
    if (result.status >= 200 && result.status < 300) {
      auditReq(req, 'proxy.clear_history', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
    }
    res.status(result.status).json(result.data);
  } catch (error: any) {
    res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
  }
});

export default router;
