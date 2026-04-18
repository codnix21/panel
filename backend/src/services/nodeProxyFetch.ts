import { pool } from '../db';

export type NodeRow = { ip: string; port: number; token: string };

export async function getNodeWithToken(nodeId: string): Promise<NodeRow | null> {
  const result = await pool.query('SELECT ip, port, token FROM nodes WHERE id = $1', [nodeId]);
  if (result.rows.length === 0) return null;
  return result.rows[0] as NodeRow;
}

export async function proxyToNode(
  node: NodeRow,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const url = `http://${node.ip}:${node.port}/api/proxies${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${node.token}`,
  };

  const options: RequestInit = { method, headers };
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}
