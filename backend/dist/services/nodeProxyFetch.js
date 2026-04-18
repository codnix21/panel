"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNodeWithToken = getNodeWithToken;
exports.proxyToNode = proxyToNode;
const db_1 = require("../db");
async function getNodeWithToken(nodeId) {
    const result = await db_1.pool.query('SELECT ip, port, token FROM nodes WHERE id = $1', [nodeId]);
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
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
}
//# sourceMappingURL=nodeProxyFetch.js.map