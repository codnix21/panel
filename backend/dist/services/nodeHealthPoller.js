"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshAllNodesLastSeen = refreshAllNodesLastSeen;
exports.startNodeHealthPoller = startNodeHealthPoller;
const db_1 = require("../db");
const config_1 = require("../config");
const notify_1 = require("./notify");
const lastOnline = new Map();
async function pingNode(ip, port, token) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const resp = await fetch(`http://${ip}:${port}/api/health`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
        });
        clearTimeout(timeout);
        return resp.ok;
    }
    catch {
        clearTimeout(timeout);
        return false;
    }
}
async function refreshAllNodesLastSeen() {
    try {
        const { rows } = await db_1.pool.query('SELECT id, ip, port, token, name FROM nodes');
        for (const row of rows) {
            const ok = await pingNode(row.ip, row.port, row.token);
            const id = row.id;
            const prev = lastOnline.get(id);
            if (prev === true && !ok) {
                void (0, notify_1.notifyAlert)('Нода не отвечает', `Нода #${id} ${row.name || ''} (${row.ip}:${row.port}) — ранее отвечала, сейчас health не OK.`);
            }
            lastOnline.set(id, ok);
            if (ok) {
                await db_1.pool.query('UPDATE nodes SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
            }
        }
    }
    catch (e) {
        console.error('node health poll error:', e);
    }
}
function startNodeHealthPoller(intervalMs) {
    const ms = intervalMs ?? config_1.config.healthPollIntervalMs;
    void refreshAllNodesLastSeen();
    return setInterval(() => void refreshAllNodesLastSeen(), ms);
}
//# sourceMappingURL=nodeHealthPoller.js.map