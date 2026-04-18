import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { copyToClipboard } from '../utils/clipboard';
import {
  getNode,
  getProxy,
  getProxyStats,
  getProxyLink,
  getProxyStatsHistory,
  getProxyIpHistory,
  getNodeBlacklist,
  getProxyContainers,
  clearProxyHistory,
  pauseProxy,
  unpauseProxy,
  NodeData,
  ProxyData,
  ProxyStatsData,
  ProxyContainersDiagnostics,
  ConnectedIpInfo,
  StatsSnapshotData,
  IpHistoryEntryData,
} from '../api';

export function useProxyDetail() {
  const { nodeId: nodeIdStr, proxyId } = useParams<{ nodeId: string; proxyId: string }>();
  const nodeId = parseInt(nodeIdStr || '0', 10);

  const [node, setNode] = useState<NodeData | null>(null);
  const [proxy, setProxy] = useState<ProxyData | null>(null);
  const [containers, setContainers] = useState<ProxyContainersDiagnostics | null>(null);
  const [stats, setStats] = useState<ProxyStatsData | null>(null);
  const [statsHistory, setStatsHistory] = useState<StatsSnapshotData[]>([]);
  const [ipHistory, setIpHistory] = useState<IpHistoryEntryData[]>([]);
  const [blacklist, setBlacklist] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [nodeGeo, setNodeGeo] = useState('');
  const [tgLink, setTgLink] = useState('');
  const chartRef = useRef<any>(null);

  const loadStats = useCallback(async () => {
    if (!proxyId) return;
    try {
      const [data, cont] = await Promise.all([
        getProxyStats(nodeId, proxyId),
        getProxyContainers(nodeId, proxyId).catch(() => null),
      ]);
      setStats(data);
      if (cont) setContainers(cont);
    } catch {}
  }, [nodeId, proxyId]);

  const loadAll = useCallback(async () => {
    if (!proxyId) return;
    try {
      const [nodeData, proxyData, statsData, history, ips, bl, cont] = await Promise.all([
        getNode(nodeId),
        getProxy(nodeId, proxyId),
        getProxyStats(nodeId, proxyId),
        getProxyStatsHistory(nodeId, proxyId),
        getProxyIpHistory(nodeId, proxyId),
        getNodeBlacklist(nodeId),
        getProxyContainers(nodeId, proxyId).catch(() => null),
      ]);
      setNode(nodeData);
      setProxy(proxyData);
      setStats(statsData);
      setContainers(cont);
      setStatsHistory(history);
      setIpHistory(ips);
      setBlacklist(new Set(bl));
      setError('');
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [nodeId, proxyId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!proxyId) {
      setTgLink('');
      return;
    }
    let cancelled = false;
    getProxyLink(nodeId, proxyId)
      .then((link) => {
        if (!cancelled) setTgLink(link);
      })
      .catch(() => {
        if (!cancelled) setTgLink('');
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId, proxyId]);

  useEffect(() => {
    if (node?.ip) {
      fetch(`http://ip-api.com/json/${node.ip}?fields=countryCode`)
        .then((r) => r.json())
        .then((d: any) => { if (d.countryCode) setNodeGeo(d.countryCode); })
        .catch(() => {});
    }
  }, [node?.ip]);

  useEffect(() => {
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [loadStats]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!proxyId) return;
      try {
        const [history, ips] = await Promise.all([
          getProxyStatsHistory(nodeId, proxyId),
          getProxyIpHistory(nodeId, proxyId),
        ]);
        setStatsHistory(history);
        setIpHistory(ips);
      } catch {}
    }, 300000);
    return () => clearInterval(interval);
  }, [nodeId, proxyId]);

  const handleCopyLink = async () => {
    if (!proxyId) return;
    try {
      const link = await getProxyLink(nodeId, proxyId);
      await copyToClipboard(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTogglePause = async () => {
    if (!proxyId || !stats) return;
    setTogglingPause(true);
    try {
      if (stats.status === 'paused') {
        await unpauseProxy(nodeId, proxyId);
      } else {
        await pauseProxy(nodeId, proxyId);
      }
      await loadStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingPause(false);
    }
  };

  const handleClearHistory = async () => {
    if (!proxyId) return;
    setClearing(true);
    try {
      await clearProxyHistory(nodeId, proxyId);
      setStatsHistory([]);
      setIpHistory([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClearing(false);
    }
  };

  const connectedIpSet = new Set(stats?.connectedIps?.map((c: ConnectedIpInfo) => c.ip) || []);

  const statusTheme = (stats?.status === 'running' ? 'success' : stats?.status === 'paused' ? 'warning' : 'danger') as 'success' | 'warning' | 'danger';
  const statusLabel = stats?.status === 'running' ? 'работает' : stats?.status === 'paused' ? 'пауза' : stats?.status === 'stopped' ? 'остановлен' : 'ошибка';

  const sortedIpHistory = [...ipHistory].sort((a, b) => {
    const aConn = connectedIpSet.has(a.ip) ? 0 : blacklist.has(a.ip) ? 2 : 1;
    const bConn = connectedIpSet.has(b.ip) ? 0 : blacklist.has(b.ip) ? 2 : 1;
    if (aConn !== bConn) return aConn - bConn;
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
  });

  return {
    nodeId, proxyId: proxyId || '', node, proxy, containers, stats, statsHistory, ipHistory: sortedIpHistory, blacklist,
    loading, error, setError, copied, togglingPause, clearing, nodeGeo, tgLink, chartRef,
    connectedIpSet, statusTheme, statusLabel,
    handleCopyLink, handleTogglePause, handleClearHistory,
  };
}
