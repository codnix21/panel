"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const auditHelpers_1 = require("../middleware/auditHelpers");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
async function getNodeWithToken(nodeId) {
    const result = await db_1.pool.query('SELECT * FROM nodes WHERE id = $1', [nodeId]);
    if (result.rows.length === 0)
        return null;
    return result.rows[0];
}
async function proxyToNode(node, method, path, body) {
    const url = `http://${node.ip}:${node.port}/api/proxies${path}`;
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${node.token}`,
    };
    const options = { method, headers };
    if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    const data = await response.json();
    return { status: response.status, data };
}
// List proxies on a node
router.get('/:nodeId/proxies', async (req, res) => {
    try {
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'GET', '');
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Create proxy on a node
router.post('/:nodeId/proxies', async (req, res) => {
    try {
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'POST', '', req.body);
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
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Update proxy
router.put('/:nodeId/proxies/:proxyId', async (req, res) => {
    try {
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'PUT', `/${req.params.proxyId}`, req.body);
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
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'DELETE', `/${req.params.proxyId}`);
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
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}/containers`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Get proxy container logs (proxied from node)
router.get('/:nodeId/proxies/:proxyId/logs', async (req, res) => {
    try {
        const node = await getNodeWithToken(req.params.nodeId);
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
        const result = await proxyToNode(node, 'GET', path);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Get proxy stats
router.get('/:nodeId/proxies/:proxyId/stats', async (req, res) => {
    try {
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}/stats`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Get proxy link
router.get('/:nodeId/proxies/:proxyId/link', async (req, res) => {
    try {
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}/link?server_ip=${node.ip}`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Pause proxy
router.post('/:nodeId/proxies/:proxyId/pause', async (req, res) => {
    try {
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'POST', `/${req.params.proxyId}/pause`);
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
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'POST', `/${req.params.proxyId}/unpause`);
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
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}/stats-history`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Get proxy IP history
router.get('/:nodeId/proxies/:proxyId/ip-history', async (req, res) => {
    try {
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'GET', `/${req.params.proxyId}/ip-history`);
        res.status(result.status).json(result.data);
    }
    catch (error) {
        res.status(502).json({ error: `Failed to connect to node: ${error.message}` });
    }
});
// Clear proxy history
router.delete('/:nodeId/proxies/:proxyId/clear-history', async (req, res) => {
    try {
        const node = await getNodeWithToken(req.params.nodeId);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        const result = await proxyToNode(node, 'DELETE', `/${req.params.proxyId}/clear-history`);
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