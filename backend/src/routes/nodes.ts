import { Router, Response } from 'express';
import * as net from 'net';
import { randomBytes } from 'crypto';
import { pool } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { auditReq } from '../middleware/auditHelpers';

function checkTcp(host: string, port: number, timeoutMs: number): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (ok: boolean, error?: string) => {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve({ ok, error });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('error', (err: NodeJS.ErrnoException) => finish(false, err.message));
    socket.once('timeout', () => finish(false, 'timeout'));
  });
}

const router = Router();

router.use(authMiddleware);

// List all nodes
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name, ip, port, created_at FROM nodes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check connectivity before adding a node
router.post('/check-health', async (req: AuthRequest, res: Response) => {
  const { ip, port, token } = req.body;
  if (!ip || !port || !token) {
    res.status(400).json({ error: 'ip, port, and token are required' });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(`http://${ip}:${port}/api/health`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    res.json({ online: resp.ok });
  } catch {
    clearTimeout(timeout);
    res.json({ online: false });
  }
});

// Add a node
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, ip, port, token } = req.body;

  if (!ip || !port || !token) {
    res.status(400).json({ error: 'ip, port, and token are required' });
    return;
  }

  try {
    const result = await pool.query(
      'INSERT INTO nodes (name, ip, port, token) VALUES ($1, $2, $3, $4) RETURNING id, name, ip, port, created_at',
      [name || `Node ${ip}`, ip, port, token]
    );
    const row = result.rows[0];
    auditReq(req, 'node.create', 'node', String(row.id), { name: row.name, ip: row.ip });
    res.status(201).json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Rotate node API token (update in panel DB; user must sync .env on the node)
router.post('/:id/rotate-token', async (req: AuthRequest, res: Response) => {
  try {
    const newToken = randomBytes(32).toString('hex');
    const result = await pool.query(
      `UPDATE nodes SET token = $1 WHERE id = $2 RETURNING id, name, ip, port, created_at`,
      [newToken, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const row = result.rows[0];
    auditReq(req, 'node.token_rotate', 'node', String(row.id), { name: row.name });
    res.json({
      token: newToken,
      node: row,
      hint: 'Обновите AUTH_TOKEN в .env на сервере ноды и перезапустите контейнеры (docker compose restart).',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a node
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name, ip, port, token, created_at FROM nodes WHERE id = $1', [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update node
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { name, ip, port, token } = req.body;

  try {
    const result = await pool.query(
      'UPDATE nodes SET name = COALESCE($1, name), ip = COALESCE($2, ip), port = COALESCE($3, port), token = COALESCE($4, token) WHERE id = $5 RETURNING id, name, ip, port, created_at',
      [name, ip, port, token, req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const row = result.rows[0];
    auditReq(req, 'node.update', 'node', String(row.id), { name: row.name, ip: row.ip });
    res.json(row);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Node runtime info (nginx port, etc.)
router.get('/:id/info', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT ip, port, token FROM nodes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const node = result.rows[0];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(`http://${node.ip}:${node.port}/api/info`, {
        headers: { Authorization: `Bearer ${node.token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await resp.json();
      res.status(resp.status).json(data);
    } catch (err: any) {
      clearTimeout(timeout);
      res.status(502).json({ error: `Failed to connect to node: ${err.message}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Nginx container logs on node
router.get('/:id/nginx-logs', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT ip, port, token FROM nodes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const node = result.rows[0];
    const q = new URLSearchParams();
    if (req.query.tail) q.set('tail', String(req.query.tail));
    const qs = q.toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const resp = await fetch(`http://${node.ip}:${node.port}/api/nginx/logs${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${node.token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await resp.json();
      res.status(resp.status).json(data);
    } catch (err: any) {
      clearTimeout(timeout);
      res.status(502).json({ error: `Failed to connect to node: ${err.message}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// TCP reachability from panel to node public IP
router.post('/:id/check-port', async (req: AuthRequest, res: Response) => {
  try {
    const port = parseInt(String(req.body?.port), 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      res.status(400).json({ error: 'body.port must be between 1 and 65535' });
      return;
    }
    const result = await pool.query('SELECT ip FROM nodes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const host = result.rows[0].ip as string;
    const check = await checkTcp(host, port, 5000);
    res.json({ ok: check.ok, host, port, error: check.error });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check a node
router.get('/:id/health', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT ip, port, token FROM nodes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const node = result.rows[0];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch(`http://${node.ip}:${node.port}/api/health`, {
        headers: { Authorization: `Bearer ${node.token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      res.json({ online: resp.ok });
    } catch {
      clearTimeout(timeout);
      res.json({ online: false });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a node
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM nodes WHERE id = $1 RETURNING id, name', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const row = result.rows[0];
    auditReq(req, 'node.delete', 'node', String(row.id), { name: row.name });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger update on a node
router.post('/:id/update', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT ip, port, token FROM nodes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const node = result.rows[0];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const resp = await fetch(`http://${node.ip}:${node.port}/api/update`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${node.token}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await resp.json();
      if (resp.ok) auditReq(req, 'node.remote_update', 'node', req.params.id, {});
      res.status(resp.status).json(data);
    } catch (err: any) {
      clearTimeout(timeout);
      res.status(502).json({ error: `Failed to connect to node: ${err.message}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get node domains
router.get('/:id/domains', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT ip, port, token FROM nodes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const node = result.rows[0];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(`http://${node.ip}:${node.port}/api/domains`, {
        headers: { Authorization: `Bearer ${node.token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await resp.json();
      res.status(resp.status).json(data);
    } catch (err: any) {
      clearTimeout(timeout);
      res.status(502).json({ error: `Failed to connect to node: ${err.message}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update node domains
router.put('/:id/domains', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT ip, port, token FROM nodes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const node = result.rows[0];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(`http://${node.ip}:${node.port}/api/domains`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${node.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await resp.json();
      if (resp.ok) auditReq(req, 'node.domains_update', 'node', req.params.id, {});
      res.status(resp.status).json(data);
    } catch (err: any) {
      clearTimeout(timeout);
      res.status(502).json({ error: `Failed to connect to node: ${err.message}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get node IP blacklist
router.get('/:id/blacklist', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT ip, port, token FROM nodes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const node = result.rows[0];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(`http://${node.ip}:${node.port}/api/blacklist`, {
        headers: { Authorization: `Bearer ${node.token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await resp.json();
      res.status(resp.status).json(data);
    } catch (err: any) {
      clearTimeout(timeout);
      res.status(502).json({ error: `Failed to connect to node: ${err.message}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update node IP blacklist
router.put('/:id/blacklist', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT ip, port, token FROM nodes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }
    const node = result.rows[0];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(`http://${node.ip}:${node.port}/api/blacklist`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${node.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await resp.json();
      if (resp.ok) auditReq(req, 'node.blacklist_update', 'node', req.params.id, {});
      res.status(resp.status).json(data);
    } catch (err: any) {
      clearTimeout(timeout);
      res.status(502).json({ error: `Failed to connect to node: ${err.message}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
