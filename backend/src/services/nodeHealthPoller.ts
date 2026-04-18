import { pool } from '../db';
import { config } from '../config';
import { notifyAlert } from './notify';

const lastOnline = new Map<number, boolean>();

async function pingNode(ip: string, port: number, token: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(`http://${ip}:${port}/api/health`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

export async function refreshAllNodesLastSeen(): Promise<void> {
  try {
    const { rows } = await pool.query('SELECT id, ip, port, token, name FROM nodes');
    for (const row of rows) {
      const ok = await pingNode(row.ip, row.port, row.token);
      const id = row.id as number;
      const prev = lastOnline.get(id);
      if (prev === true && !ok) {
        void notifyAlert(
          'Нода не отвечает',
          `Нода #${id} ${row.name || ''} (${row.ip}:${row.port}) — ранее отвечала, сейчас health не OK.`
        );
      }
      lastOnline.set(id, ok);
      if (ok) {
        await pool.query('UPDATE nodes SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      }
    }
  } catch (e) {
    console.error('node health poll error:', e);
  }
}

export function startNodeHealthPoller(intervalMs?: number): NodeJS.Timeout {
  const ms = intervalMs ?? config.healthPollIntervalMs;
  void refreshAllNodesLastSeen();
  return setInterval(() => void refreshAllNodesLastSeen(), ms);
}
