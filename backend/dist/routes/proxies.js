"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const auditHelpers_1 = require("../middleware/auditHelpers");
const nodeProxyFetch_1 = require("../services/nodeProxyFetch");
const notify_1 = require("../services/notify");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Batch: pause | unpause | restart
router.post('/:nodeId/proxies/batch', async (req, res) => {
    try {
        const { action, proxyIds } = req.body;
        if (!action || !['pause', 'unpause', 'restart'].includes(action) || !Array.isArray(proxyIds)) {
            res.status(400).json({ error: 'action (pause|unpause|restart) and proxyIds[] required' });
            return;
        }
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const results = [];
        for (const pid of proxyIds) {
            const path = action === 'restart' ? `/${pid}/restart` : `/${pid}/${action}`;
            try {
                const r = await (0, nodeProxyFetch_1.proxyToNode)(node, 'POST', path);
                const ok = r.status >= 200 && r.status < 300;
                results.push({
                    id: pid,
                    ok,
                    status: r.status,
                    error: ok ? undefined : typeof r.data?.error === 'string' ? r.data.error : JSON.stringify(r.data),
                });
                if (ok) {
                    (0, auditHelpers_1.auditReq)(req, `proxy.batch_${action}`, 'proxy', pid, { nodeId: req.params.nodeId });
                }
            }
            catch (e) {
                results.push({ id: pid, ok: false, status: 0, error: e.message });
            }
        }
        const failed = results.filter((x) => !x.ok);
        if (failed.length > 0) {
            void (0, notify_1.notifyAlert)('Массовая операция: часть ошибок', `Нода ${req.params.nodeId}, ${action}, ошибок ${failed.length}/${results.length}. ID: ${failed.map((f) => f.id).join(', ')}`);
        }
        res.json({ results });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Batch SNI/domain update
router.post('/:nodeId/proxies/batch-domain', async (req, res) => {
    try {
        const { proxyIds, domain } = req.body;
        if (!Array.isArray(proxyIds) || !domain || typeof domain !== 'string') {
            res.status(400).json({ error: 'proxyIds[] and domain required' });
            return;
        }
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const results = [];
        for (const pid of proxyIds) {
            const r = await (0, nodeProxyFetch_1.proxyToNode)(node, 'PUT', `/${pid}`, { domain });
            const ok = r.status >= 200 && r.status < 300;
            results.push({ id: pid, ok, error: ok ? undefined : JSON.stringify(r.data) });
            if (ok)
                (0, auditHelpers_1.auditReq)(req, 'proxy.batch_domain', 'proxy', pid, { nodeId: req.params.nodeId, domain });
        }
        const failed = results.filter((x) => !x.ok);
        if (failed.length > 0) {
            void (0, notify_1.notifyAlert)('Смена SNI: часть ошибок', `Нода ${req.params.nodeId}, домен ${domain}, ошибок ${failed.length}/${results.length}. ID: ${failed.map((f) => f.id).join(', ')}`);
        }
        res.json({ results });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Clone proxy (same or another node)
router.post('/:nodeId/proxies/:proxyId/clone', async (req, res) => {
    try {
        const { targetNodeId, domain, name } = req.body;
        const srcNode = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!srcNode) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const tgtId = targetNodeId != null ? String(targetNodeId) : req.params.nodeId;
        const tgtNode = await (0, nodeProxyFetch_1.getNodeWithToken)(tgtId);
        if (!tgtNode) {
            res.status(404).json({ error: 'Target node not found' });
            return;
        }
        const g = await (0, nodeProxyFetch_1.proxyToNode)(srcNode, 'GET', `/${req.params.proxyId}`);
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
        const c = await (0, nodeProxyFetch_1.proxyToNode)(tgtNode, 'POST', '', createBody);
        if (c.status >= 200 && c.status < 300 && c.data?.id) {
            (0, auditHelpers_1.auditReq)(req, 'proxy.clone', 'proxy', String(c.data.id), {
                fromProxyId: req.params.proxyId,
                fromNodeId: req.params.nodeId,
                targetNodeId: tgtId,
            });
        }
        res.status(c.status).json(c.data);
    }
    catch (error) {
        res.status(502).json({ error: error.message });
    }
});
// Panel-only tags for a proxy
router.get('/:nodeId/proxies/:proxyId/panel-meta', async (req, res) => {
    try {
        const r = await db_1.pool.query('SELECT tags FROM proxy_meta WHERE node_id = $1 AND proxy_id = $2', [
            req.params.nodeId,
            req.params.proxyId,
        ]);
        res.json({ tags: r.rows[0]?.tags?.length ? r.rows[0].tags : [] });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:nodeId/proxies/:proxyId/panel-meta', async (req, res) => {
    try {
        const { tags } = req.body;
        if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) {
            res.status(400).json({ error: 'tags must be string[]' });
            return;
        }
        await db_1.pool.query(`INSERT INTO proxy_meta (node_id, proxy_id, tags) VALUES ($1, $2, $3::text[])
       ON CONFLICT (node_id, proxy_id) DO UPDATE SET tags = EXCLUDED.tags`, [req.params.nodeId, req.params.proxyId, tags]);
        (0, auditHelpers_1.auditReq)(req, 'proxy.tags_update', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
        res.json({ tags });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// List proxies on a node
router.get('/:nodeId/proxies', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'GET', '');
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Create proxy on a node
router.post('/:nodeId/proxies', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'POST', '', req.body);
        if (result.status >= 200 && result.status < 300 && result.data?.id) {
            (0, auditHelpers_1.auditReq)(req, 'proxy.create', 'proxy', String(result.data.id), { nodeId: req.params.nodeId });
        }
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Get proxy details
router.get('/:nodeId/proxies/:proxyId', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'GET', `/${req.params.proxyId}`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Update proxy
router.put('/:nodeId/proxies/:proxyId', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'PUT', `/${req.params.proxyId}`, req.body);
        if (result.status >= 200 && result.status < 300) {
            (0, auditHelpers_1.auditReq)(req, 'proxy.update', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
        }
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Delete proxy
router.delete('/:nodeId/proxies/:proxyId', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'DELETE', `/${req.params.proxyId}`);
        if (result.status >= 200 && result.status < 300) {
            (0, auditHelpers_1.auditReq)(req, 'proxy.delete', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
        }
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Docker container inspect (proxy + xray)
router.get('/:nodeId/proxies/:proxyId/containers', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'GET', `/${req.params.proxyId}/containers`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Get proxy container logs (proxied from node)
router.get('/:nodeId/proxies/:proxyId/logs', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const q = new URLSearchParams();
        if (req.query.target)
            q.set('target', String(req.query.target));
        if (req.query.tail)
            q.set('tail', String(req.query.tail));
        const qs = q.toString();
        const path = `/${req.params.proxyId}/logs${qs ? `?${qs}` : ''}`;
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'GET', path);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Get proxy stats
router.get('/:nodeId/proxies/:proxyId/stats', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'GET', `/${req.params.proxyId}/stats`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Get proxy link
router.get('/:nodeId/proxies/:proxyId/link', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'GET', `/${req.params.proxyId}/link?server_ip=${node.ip}`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Pause proxy
router.post('/:nodeId/proxies/:proxyId/pause', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'POST', `/${req.params.proxyId}/pause`);
        if (result.status >= 200 && result.status < 300) {
            (0, auditHelpers_1.auditReq)(req, 'proxy.pause', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
        }
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Unpause proxy
router.post('/:nodeId/proxies/:proxyId/unpause', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'POST', `/${req.params.proxyId}/unpause`);
        if (result.status >= 200 && result.status < 300) {
            (0, auditHelpers_1.auditReq)(req, 'proxy.unpause', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
        }
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Get proxy stats history
router.get('/:nodeId/proxies/:proxyId/stats-history', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'GET', `/${req.params.proxyId}/stats-history`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Get proxy IP history
router.get('/:nodeId/proxies/:proxyId/ip-history', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'GET', `/${req.params.proxyId}/ip-history`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Clear proxy history
router.delete('/:nodeId/proxies/:proxyId/clear-history', async (req, res) => {
    try {
        const node = await (0, nodeProxyFetch_1.getNodeWithToken)(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await (0, nodeProxyFetch_1.proxyToNode)(node, 'DELETE', `/${req.params.proxyId}/clear-history`);
        if (result.status >= 200 && result.status < 300) {
            (0, auditHelpers_1.auditReq)(req, 'proxy.clear_history', 'proxy', req.params.proxyId, { nodeId: req.params.nodeId });
        }
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
exports.default = router;
//# sourceMappingURL=proxies.js.map