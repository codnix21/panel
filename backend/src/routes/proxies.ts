import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { auditReq } from '../middleware/auditHelpers';

const router = Router();

router.use(authMiddleware);

async function getNodeWithToken(nodeId: string) {
  const result = await pool.query('SELECT * FROM nodes WHERE id = $1', [nodeId]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

async function proxyToNode(
  node: { ip: string; port: number; token: string },
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const url = `http://${node.ip}:${node.port}/api/proxies${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${node.token}`,
  };

  const options: RequestInit = { method, headers };
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();
  return { status: response.status, data };
}

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
