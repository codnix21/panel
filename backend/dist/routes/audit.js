"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
function csvEscape(v) {
    const s = v == null ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
}
router.get('/export.csv', async (req, res) => {
    try {
        const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
        const from = typeof req.query.from === 'string' ? req.query.from : '';
        const to = typeof req.query.to === 'string' ? req.query.to : '';
        const conditions = ['1=1'];
        const params = [];
        let p = 1;
        if (action) {
            conditions.push(`action = $${p++}`);
            params.push(action);
        }
        if (from) {
            conditions.push(`created_at >= $${p++}::timestamptz`);
            params.push(from);
        }
        if (to) {
            conditions.push(`created_at <= $${p++}::timestamptz`);
            params.push(to);
        }
        const where = conditions.join(' AND ');
        const result = await db_1.pool.query(`SELECT id, user_id, username, action, resource_type, resource_id, details, ip, created_at
       FROM audit_log WHERE ${where} ORDER BY created_at DESC LIMIT 10000`, params);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');
        const lines = [
            'id,user_id,username,action,resource_type,resource_id,ip,created_at,details',
            ...result.rows.map((r) => [
                r.id,
                r.user_id ?? '',
                r.username ?? '',
                r.action,
                r.resource_type ?? '',
                r.resource_id ?? '',
                r.ip ?? '',
                r.created_at,
                JSON.stringify(r.details ?? {}),
            ]
                .map(csvEscape)
                .join(',')),
        ];
        res.send(lines.join('\n'));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
        const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);
        const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
        const from = typeof req.query.from === 'string' ? req.query.from : '';
        const to = typeof req.query.to === 'string' ? req.query.to : '';
        const conditions = ['1=1'];
        const params = [];
        let p = 1;
        if (action) {
            conditions.push(`action = $${p++}`);
            params.push(action);
        }
        if (from) {
            conditions.push(`created_at >= $${p++}::timestamptz`);
            params.push(from);
        }
        if (to) {
            conditions.push(`created_at <= $${p++}::timestamptz`);
            params.push(to);
        }
        const where = conditions.join(' AND ');
        const countResult = await db_1.pool.query(`SELECT COUNT(*)::int AS c FROM audit_log WHERE ${where}`, [...params]);
        const total = countResult.rows[0]?.c ?? 0;
        const listParams = [...params, limit, offset];
        const limIdx = p;
        const offIdx = p + 1;
        const result = await db_1.pool.query(`SELECT id, user_id, username, action, resource_type, resource_id, details, ip, created_at
       FROM audit_log WHERE ${where} ORDER BY created_at DESC LIMIT $${limIdx} OFFSET $${offIdx}`, listParams);
        res.json({ rows: result.rows, total });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=audit.js.map