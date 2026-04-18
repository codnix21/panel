"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);
        const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);
        const result = await db_1.pool.query(`SELECT id, user_id, username, action, resource_type, resource_id, details, ip, created_at
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`, [limit, offset]);
        res.json(result.rows);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=audit.js.map