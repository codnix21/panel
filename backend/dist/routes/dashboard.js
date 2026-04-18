"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const config_1 = require("../config");
const auth_1 = require("../middleware/auth");
const nodeProxyFetch_1 = require("../services/nodeProxyFetch");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/summary', async (_req, res) => {
    try {
        const n = await db_1.pool.query('SELECT id, name, ip, last_seen_at FROM nodes ORDER BY id');
        let proxyTotal = 0;
        let runningCount = 0;
        for (const row of n.rows) {
            const node = await (0, nodeProxyFetch_1.getNodeWithToken)(String(row.id));
            if (!node)
                continue;
            try {
                const r = await (0, nodeProxyFetch_1.proxyToNode)(node, 'GET', '');
                if (r.status === 200 && Array.isArray(r.data)) {
                    proxyTotal += r.data.length;
                    for (const p of r.data) {
                        if (p.status === 'running')
                            runningCount += 1;
                    }
                }
            }
            catch {
                // offline node
            }
        }
        const recent = await db_1.pool.query(`SELECT id, username, action, resource_type, resource_id, ip, created_at
       FROM audit_log ORDER BY created_at DESC LIMIT 20`);
        const failed = await db_1.pool.query(`SELECT COUNT(*)::int AS c FROM audit_log
       WHERE action = 'auth.login_failed' AND created_at > NOW() - INTERVAL '24 hours'`);
        const nodeImageHints = [];
        for (const row of n.rows) {
            const node = await (0, nodeProxyFetch_1.getNodeWithToken)(String(row.id));
            if (!node)
                continue;
            const hint = {
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
                }
                else {
                    const data = (await resp.json());
                    const images = data.images || {};
                    const proxyRef = [images.proxyImage?.name, images.proxyImage?.id].filter(Boolean).join(' ');
                    const nginxRef = [images.nginx?.imageName, images.nginx?.imageId].filter(Boolean).join(' ');
                    hint.proxyImage = proxyRef || undefined;
                    hint.nginxImage = nginxRef || undefined;
                    if (config_1.config.expectedProxyImageRef && proxyRef && !proxyRef.includes(config_1.config.expectedProxyImageRef)) {
                        hint.proxyMismatch = true;
                    }
                    if (config_1.config.expectedNginxImageRef && nginxRef && !nginxRef.includes(config_1.config.expectedNginxImageRef)) {
                        hint.nginxMismatch = true;
                    }
                }
            }
            catch (e) {
                hint.error = e?.message || 'unreachable';
            }
            nodeImageHints.push(hint);
        }
        const showImageUpdateBanner = Boolean(config_1.config.expectedProxyImageRef || config_1.config.expectedNginxImageRef) &&
            nodeImageHints.some((h) => h.proxyMismatch || h.nginxMismatch);
        res.json({
            nodeCount: n.rows.length,
            proxyTotal,
            runningCount,
            nodes: n.rows,
            recentAudit: recent.rows,
            failedLogins24h: failed.rows[0]?.c ?? 0,
            healthStaleAfterMs: config_1.config.healthStaleAfterMs,
            healthPollIntervalMs: config_1.config.healthPollIntervalMs,
            expectedProxyImageRef: config_1.config.expectedProxyImageRef ?? null,
            expectedNginxImageRef: config_1.config.expectedNginxImageRef ?? null,
            nodeImageHints,
            showImageUpdateBanner,
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map