"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const nodeProxyFetch_1 = require("../services/nodeProxyFetch");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
function csvEscape(v) {
    const s = v == null ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
}
router.get('/nodes.csv', async (_req, res) => {
    try {
        const r = await db_1.pool.query('SELECT id, name, ip, port, created_at, last_seen_at FROM nodes ORDER BY id');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="nodes.csv"');
        const lines = [
            'id,name,ip,port,created_at,last_seen_at',
            ...r.rows.map((row) => [row.id, row.name, row.ip, row.port, row.created_at, row.last_seen_at ?? '']
                .map(csvEscape)
                .join(',')),
        ];
        res.send(lines.join('\n'));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/proxies.csv', async (_req, res) => {
    try {
        const nodesResult = await db_1.pool.query('SELECT * FROM nodes ORDER BY id');
        const metaResult = await db_1.pool.query('SELECT node_id, proxy_id, tags FROM proxy_meta');
        const tagMap = new Map();
        for (const m of metaResult.rows) {
            tagMap.set(`${m.node_id}:${m.proxy_id}`, (m.tags || []).join(';'));
        }
        const rows = [];
        for (const node of nodesResult.rows) {
            const n = await (0, nodeProxyFetch_1.getNodeWithToken)(String(node.id));
            if (!n)
                continue;
            try {
                const r = await (0, nodeProxyFetch_1.proxyToNode)(n, 'GET', '');
                if (r.status !== 200 || !Array.isArray(r.data))
                    continue;
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
            }
            catch {
                // skip offline
            }
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="proxies.csv"');
        const header = 'node_id,node_name,node_ip,proxy_id,proxy_name,domain,status,note,tags';
        const lines = [
            header,
            ...rows.map((cols) => cols.map(csvEscape).join(',')),
        ];
        res.send(lines.join('\n'));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=exportCsv.js.map