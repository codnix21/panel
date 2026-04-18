"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const nodeProxyFetch_1 = require("../services/nodeProxyFetch");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', async (req, res) => {
    try {
        const raw = String(req.query.q || '').trim();
        const q = raw.toLowerCase();
        if (!q || q.length < 2) {
            res.json({ nodes: [], proxies: [] });
            return;
        }
        const nodes = await db_1.pool.query(`SELECT id, name, ip, port, last_seen_at FROM nodes
       WHERE LOWER(name) LIKE $1 OR ip LIKE $1 OR CAST(id AS TEXT) = $2
       ORDER BY id LIMIT 25`, [`%${q}%`, raw]);
        const proxies = [];
        const metaRows = await db_1.pool.query('SELECT node_id, proxy_id, tags FROM proxy_meta');
        const tagStr = new Map();
        for (const m of metaRows.rows) {
            tagStr.set(`${m.node_id}:${m.proxy_id}`, (m.tags || []).join(' '));
        }
        const allNodes = await db_1.pool.query('SELECT id, name, ip, port, token FROM nodes');
        for (const row of allNodes.rows) {
            const node = await (0, nodeProxyFetch_1.getNodeWithToken)(String(row.id));
            if (!node)
                continue;
            try {
                const r = await (0, nodeProxyFetch_1.proxyToNode)(node, 'GET', '');
                if (r.status !== 200 || !Array.isArray(r.data))
                    continue;
                for (const p of r.data) {
                    const tags = tagStr.get(`${row.id}:${p.id}`) || '';
                    const hay = `${p.id} ${p.name || ''} ${p.domain || ''} ${tags}`.toLowerCase();
                    if (hay.includes(q)) {
                        proxies.push({ nodeId: row.id, nodeName: row.name, proxy: p });
                    }
                }
            }
            catch {
                // skip
            }
        }
        res.json({ nodes: nodes.rows, proxies: proxies.slice(0, 40) });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=search.js.map