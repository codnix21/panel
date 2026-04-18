"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const auditHelpers_1 = require("../middleware/auditHelpers");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', async (_req, res) => {
    try {
        const r = await db_1.pool.query('SELECT id, name, preset, created_at FROM proxy_templates ORDER BY id DESC');
        res.json(r.rows);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const { name, preset } = req.body;
        if (!name || typeof name !== 'string') {
            res.status(400).json({ error: 'name required' });
            return;
        }
        const r = await db_1.pool.query('INSERT INTO proxy_templates (name, preset) VALUES ($1, $2::jsonb) RETURNING id, name, preset, created_at', [name, JSON.stringify(preset || {})]);
        (0, auditHelpers_1.auditReq)(req, 'template.create', 'template', String(r.rows[0].id), { name });
        res.status(201).json(r.rows[0]);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const r = await db_1.pool.query('DELETE FROM proxy_templates WHERE id = $1 RETURNING id', [req.params.id]);
        if (r.rows.length === 0) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        (0, auditHelpers_1.auditReq)(req, 'template.delete', 'template', req.params.id, {});
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=templates.js.map