const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Auth
export async function login(username: string, password: string) {
  const data = await request<{ token: string; user: { id: number; username: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem('token', data.token);
  return data;
}

export async function getMe() {
  return request<{ user: { userId: number; username: string } }>('/auth/me');
}

export function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login';
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// Nodes
export interface NodeData {
  id: number;
  name: string;
  ip: string;
  port: number;
  token?: string;
  created_at: string;
  online?: boolean;
}

export async function getNodes(): Promise<NodeData[]> {
  return request<NodeData[]>('/nodes');
}

export async function getNode(id: number): Promise<NodeData> {
  return request<NodeData>(`/nodes/${id}`);
}

export async function createNode(data: { name?: string; ip: string; port: number; token: string }) {
  return request<NodeData>('/nodes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateNode(id: number, data: { name?: string; ip?: string; port?: number; token?: string }) {
  return request<NodeData>(`/nodes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteNode(id: number) {
  return request<{ success: boolean }>(`/nodes/${id}`, { method: 'DELETE' });
}

export async function rotateNodeToken(nodeId: number): Promise<{ token: string; node: NodeData; hint: string }> {
  return request(`/nodes/${nodeId}/rotate-token`, { method: 'POST' });
}

export interface AuditLogRow {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export async function getAuditLog(params?: { limit?: number; offset?: number }): Promise<AuditLogRow[]> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  return request<AuditLogRow[]>(`/audit${qs ? `?${qs}` : ''}`);
}

export async function checkNodeHealth(id: number): Promise<{ online: boolean }> {
  return request<{ online: boolean }>(`/nodes/${id}/health`);
}

export async function checkNodeConnection(ip: string, port: number, token: string): Promise<{ online: boolean }> {
  return request<{ online: boolean }>('/nodes/check-health', {
    method: 'POST',
    body: JSON.stringify({ ip, port, token }),
  });
}

export async function updateNodeService(id: number): Promise<{ success: boolean; output?: string; error?: string }> {
  return request<{ success: boolean; output?: string; error?: string }>(`/nodes/${id}/update`, {
    method: 'POST',
  });
}

// Proxies
export interface ConnectedIpInfo {
  ip: string;
  country?: string;
  countryCode?: string;
}

export interface ProxyData {
  id: string;
  name: string;
  note: string;
  port: number;
  secret: string;
  domain: string;
  containerName: string;
  status: 'running' | 'stopped' | 'paused' | 'error';
  createdAt: string;
  trafficUp: number;
  trafficDown: number;
  connectedIps: string[];
  maxConnections?: number;
  listenPort?: number;
  vpnSubscription?: string;
  vpnContainerName?: string;
}

export interface ProxyStatsData {
  id: string;
  containerName: string;
  status: string;
  cpuPercent: string;
  memoryUsage: string;
  memoryLimit: string;
  networkRx: string;
  networkTx: string;
  networkRxBytes: number;
  networkTxBytes: number;
  uptime: string;
  connectedIps: ConnectedIpInfo[];
}

export interface CreateProxyRequest {
  secret?: string;
  domain?: string;
  name?: string;
  note?: string;
  maxConnections?: number;
  listenPort?: number;
  vpnSubscription?: string;
}

export interface StatsSnapshotData {
  timestamp: string;
  cpuPercent: number;
  memoryBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  connectedCount: number;
}

export interface IpHistoryEntryData {
  ip: string;
  country?: string;
  countryCode?: string;
  firstSeen: string;
  lastSeen: string;
}

export async function getProxies(nodeId: number): Promise<ProxyData[]> {
  return request<ProxyData[]>(`/nodes/${nodeId}/proxies`);
}

export async function getAllProxies(): Promise<{ nodeId: number; nodeName: string; nodeIp: string; proxies: ProxyData[] }[]> {
  return request<{ nodeId: number; nodeName: string; nodeIp: string; proxies: ProxyData[] }[]>('/proxies/all');
}

export async function createProxy(nodeId: number, data: CreateProxyRequest) {
  return request<ProxyData>(`/nodes/${nodeId}/proxies`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProxy(nodeId: number, proxyId: string): Promise<ProxyData> {
  return request<ProxyData>(`/nodes/${nodeId}/proxies/${proxyId}`);
}

export interface ProxyLogsResponse {
  target: string;
  tail: number;
  containerName: string;
  logs: string;
}

export async function getProxyLogs(
  nodeId: number,
  proxyId: string,
  params?: { target?: 'proxy' | 'xray'; tail?: number }
): Promise<ProxyLogsResponse> {
  const q = new URLSearchParams();
  if (params?.target) q.set('target', params.target);
  if (params?.tail != null) q.set('tail', String(params.tail));
  const qs = q.toString();
  return request<ProxyLogsResponse>(`/nodes/${nodeId}/proxies/${proxyId}/logs${qs ? `?${qs}` : ''}`);
}

export interface ContainerInspectSummary {
  status: string;
  running: boolean;
  exitCode?: number;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ProxyContainersDiagnostics {
  proxy: ContainerInspectSummary | { status: string; running: false };
  xray?: ContainerInspectSummary | { status: string; running: false };
}

export async function getProxyContainers(nodeId: number, proxyId: string): Promise<ProxyContainersDiagnostics> {
  return request<ProxyContainersDiagnostics>(`/nodes/${nodeId}/proxies/${proxyId}/containers`);
}

export async function getNodeNginxLogs(nodeId: number, tail?: number): Promise<ProxyLogsResponse> {
  const q = tail != null ? `?tail=${tail}` : '';
  return request<ProxyLogsResponse>(`/nodes/${nodeId}/nginx-logs${q}`);
}

export async function getNodeInfo(nodeId: number): Promise<{ nginxPort: number }> {
  return request<{ nginxPort: number }>(`/nodes/${nodeId}/info`);
}

export async function checkNodePort(
  nodeId: number,
  port: number
): Promise<{ ok: boolean; host: string; port: number; error?: string }> {
  return request(`/nodes/${nodeId}/check-port`, {
    method: 'POST',
    body: JSON.stringify({ port }),
  });
}

export async function updateProxy(nodeId: number, proxyId: string, data: { domain?: string; name?: string; note?: string; maxConnections?: number; vpnSubscription?: string }) {
  return request<ProxyData>(`/nodes/${nodeId}/proxies/${proxyId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProxy(nodeId: number, proxyId: string) {
  return request<{ success: boolean }>(`/nodes/${nodeId}/proxies/${proxyId}`, { method: 'DELETE' });
}

export async function getProxyStats(nodeId: number, proxyId: string): Promise<ProxyStatsData> {
  return request<ProxyStatsData>(`/nodes/${nodeId}/proxies/${proxyId}/stats`);
}

export async function getProxyLink(nodeId: number, proxyId: string): Promise<string> {
  const data = await request<{ link: string }>(`/nodes/${nodeId}/proxies/${proxyId}/link`);
  return data.link;
}

export async function pauseProxy(nodeId: number, proxyId: string): Promise<ProxyData> {
  return request<ProxyData>(`/nodes/${nodeId}/proxies/${proxyId}/pause`, { method: 'POST' });
}

export async function unpauseProxy(nodeId: number, proxyId: string): Promise<ProxyData> {
  return request<ProxyData>(`/nodes/${nodeId}/proxies/${proxyId}/unpause`, { method: 'POST' });
}

// Node domains
export async function getNodeDomains(nodeId: number): Promise<string[]> {
  const data = await request<{ domains: string[] }>(`/nodes/${nodeId}/domains`);
  return data.domains;
}

export async function updateNodeDomains(nodeId: number, domains: string[]): Promise<string[]> {
  const data = await request<{ domains: string[] }>(`/nodes/${nodeId}/domains`, {
    method: 'PUT',
    body: JSON.stringify({ domains }),
  });
  return data.domains;
}

// Node IP blacklist
export async function getNodeBlacklist(nodeId: number): Promise<string[]> {
  const data = await request<{ ips: string[] }>(`/nodes/${nodeId}/blacklist`);
  return data.ips;
}

export async function updateNodeBlacklist(nodeId: number, ips: string[]): Promise<string[]> {
  const data = await request<{ ips: string[] }>(`/nodes/${nodeId}/blacklist`, {
    method: 'PUT',
    body: JSON.stringify({ ips }),
  });
  return data.ips;
}

// Stats history
export async function getProxyStatsHistory(nodeId: number, proxyId: string): Promise<StatsSnapshotData[]> {
  return request<StatsSnapshotData[]>(`/nodes/${nodeId}/proxies/${proxyId}/stats-history`);
}

// IP history
export async function getProxyIpHistory(nodeId: number, proxyId: string): Promise<IpHistoryEntryData[]> {
  return request<IpHistoryEntryData[]>(`/nodes/${nodeId}/proxies/${proxyId}/ip-history`);
}

// Clear proxy history
export async function clearProxyHistory(nodeId: number, proxyId: string): Promise<void> {
  await request(`/nodes/${nodeId}/proxies/${proxyId}/clear-history`, { method: 'DELETE' });
}
