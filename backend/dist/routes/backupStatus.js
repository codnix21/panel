"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const promises_1 = __importDefault(require("fs/promises"));
const config_1 = require("../config");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', async (_req, res) => {
    if (!config_1.config.backupStatusFile) {
        res.json({ configured: false, lastBackupAt: null });
        return;
    }
    try {
        const raw = await promises_1.default.readFile(config_1.config.backupStatusFile, 'utf8');
        const j = JSON.parse(raw);
        res.json({ configured: true, lastBackupAt: j.lastBackupAt ?? null });
    }
    catch {
        res.json({ configured: true, lastBackupAt: null, unreadable: true });
    }
});
exports.default = router;
//# sourceMappingURL=backupStatus.js.map