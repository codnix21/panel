import { Router, Response } from 'express';
import { pool } from '../db';
import { config } from '../config';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { getNodeWithToken, proxyToNode } from '../services/nodeProxyFetch';

const router = Router();

router.use(authMiddleware);

router.get('/summary', async (_req: AuthRequest, res: Response) => {
  try {
    const n = await pool.query('SELECT id, name, ip, last_seen_at FROM nodes ORDER BY id');
    let proxyTotal = 0;
    let runningCount = 0;
    for (const row of n.rows) {
      const node = await getNodeWithToken(String(row.id));
      if (!node) continue;
      try {
        const r = await proxyToNode(node, 'GET', '');
        if (r.status === 200 && Array.isArray(r.data)) {
          proxyTotal += r.data.length;
          for (const p of r.data) {
            if (p.status === 'running') runningCount += 1;
          }
        }
      } catch {
        // offline node
      }
    }
    const recent = await pool.query(
      `SELECT id, username, action, resource_type, resource_id, ip, created_at
       FROM audit_log ORDER BY created_at DESC LIMIT 20`
    );
    const failed = await pool.query(
      `SELECT COUNT(*)::int AS c FROM audit_log
       WHERE action = 'auth.login_failed' AND created_at > NOW() - INTERVAL '24 hours'`
    );

    const nodeImageHints: {
      nodeId: number;
      nodeName: string;
      proxyImage?: string;
      nginxImage?: string;
      proxyMismatch?: boolean;
      nginxMismatch?: boolean;
      error?: string;
    }[] = [];

    for (const row of n.rows) {
      const node = await getNodeWithToken(String(row.id));
      if (!node) continue;
      const hint: (typeof nodeImageHints)[0] = {
        nodeId: row.id,
        nodeName: row.name,
      };
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(`http://${node.ip}:${node.port}/api/info`, {
          headers: { Authorization: `Bearer ${node.token}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          hint.error = `HTTP ${resp.status}`;
        } else {
          const data = (await resp.json()) as {
            images?: {
              proxyImage?: { id?: string; name?: string };
              nginx?: { imageName?: string; imageId?: string };
            };
          };
          const images = data.images || {};
          const proxyRef = [images.proxyImage?.name, images.proxyImage?.id].filter(Boolean).join(' ');
          const nginxRef = [images.nginx?.imageName, images.nginx?.imageId].filter(Boolean).join(' ');
          hint.proxyImage = proxyRef || undefined;
          hint.nginxImage = nginxRef || undefined;
          if (config.expectedProxyImageRef && proxyRef && !proxyRef.includes(config.expectedProxyImageRef)) {
            hint.proxyMismatch = true;
          }
          if (config.expectedNginxImageRef && nginxRef && !nginxRef.includes(config.expectedNginxImageRef)) {
            hint.nginxMismatch = true;
          }
        }
      } catch (e: any) {
        hint.error = e?.message || 'unreachable';
      }
      nodeImageHints.push(hint);
    }

    const showImageUpdateBanner =
      Boolean(config.expectedProxyImageRef || config.expectedNginxImageRef) &&
      nodeImageHints.some((h) => h.proxyMismatch || h.nginxMismatch);

    res.json({
      nodeCount: n.rows.length,
      proxyTotal,
      runningCount,
      nodes: n.rows,
      recentAudit: recent.rows,
      failedLogins24h: failed.rows[0]?.c ?? 0,
      healthStaleAfterMs: config.healthStaleAfterMs,
      healthPollIntervalMs: config.healthPollIntervalMs,
      expectedProxyImageRef: config.expectedProxyImageRef ?? null,
      expectedNginxImageRef: config.expectedNginxImageRef ?? null,
      nodeImageHints,
      showImageUpdateBanner,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
