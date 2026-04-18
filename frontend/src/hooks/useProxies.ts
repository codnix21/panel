import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { copyToClipboard } from '../utils/clipboard';
import {
  getAllProxies,
  getNodes,
  deleteProxy,
  getProxyLink,
  NodeData,
  ProxyData,
} from '../api';

interface NodeProxies {
  nodeId: number;
  nodeName: string;
  nodeIp: string;
  proxies: ProxyData[];
}

export type ProxyListItem = ProxyData & {
  nodeId: number;
  nodeName: string;
  nodeIp: string;
};

function parseTagsParam(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function proxyMatchesTags(proxyTags: string[] | undefined, required: string[]): boolean {
  if (required.length === 0) return true;
  const pt = (proxyTags || []).map((x) => x.toLowerCase());
  return required.every((t) => {
    const tl = t.toLowerCase();
    return pt.some((p) => p === tl || p.includes(tl));
  });
}

export function useProxies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [nodeProxies, setNodeProxies] = useState<NodeProxies[]>([]);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editProxy, setEditProxy] = useState<{ proxy: ProxyData; nodeId: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const filterNodeId = searchParams.get('node') || 'all';
  const filterStatus = searchParams.get('status') || 'all';
  const filterTags = searchParams.get('tags') || '';

  const setFilterNodeId = useCallback(
    (v: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (v === 'all') next.delete('node');
        else next.set('node', v);
        return next;
      });
    },
    [setSearchParams]
  );

  const setFilterStatus = useCallback(
    (v: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (v === 'all') next.delete('status');
        else next.set('status', v);
        return next;
      });
    },
    [setSearchParams]
  );

  const setFilterTags = useCallback(
    (v: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (!v.trim()) next.delete('tags');
        else next.set('tags', v.trim());
        return next;
      });
    },
    [setSearchParams]
  );

  const loadData = useCallback(async () => {
    try {
      const [allProxies, nodesList] = await Promise.all([
        getAllProxies(),
        getNodes(),
      ]);
      setNodeProxies(allProxies);
      setNodes(nodesList);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tagFilters = useMemo(() => parseTagsParam(filterTags), [filterTags]);

  const allProxies: ProxyListItem[] = useMemo(() => {
    let list = nodeProxies.flatMap((np) =>
      np.proxies.map((p) => ({
        ...p,
        nodeId: np.nodeId,
        nodeName: np.nodeName,
        nodeIp: np.nodeIp,
      }))
    );
    if (filterNodeId !== 'all') {
      list = list.filter((p) => p.nodeId.toString() === filterNodeId);
    }
    if (filterStatus !== 'all') {
      list = list.filter((p) => p.status === filterStatus);
    }
    if (tagFilters.length > 0) {
      list = list.filter((p) => proxyMatchesTags(p.tags, tagFilters));
    }
    return list;
  }, [nodeProxies, filterNodeId, filterStatus, tagFilters]);

  const totalProxies = nodeProxies.reduce((sum, np) => sum + np.proxies.length, 0);

  const toggleSelect = useCallback((nodeId: number, proxyId: string) => {
    const key = `${nodeId}:${proxyId}`;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedKeys(new Set(allProxies.map((p) => `${p.nodeId}:${p.id}`)));
  }, [allProxies]);

  const clearSelection = useCallback(() => setSelectedKeys(new Set()), []);

  const handleDelete = async (nodeId: number, proxyId: string) => {
    if (!confirm('Удалить этот прокси?')) return;
    try {
      await deleteProxy(nodeId, proxyId);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(`${nodeId}:${proxyId}`);
        return next;
      });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCopyLink = async (nodeId: number, proxyId: string) => {
    try {
      const link = await getProxyLink(nodeId, proxyId);
      await copyToClipboard(link);
      setCopiedId(proxyId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filterOptions = [
    { value: 'all', content: 'Все ноды' },
    ...nodes.map((n) => ({ value: n.id.toString(), content: `${n.name} (${n.ip})` })),
  ];

  const statusOptions = [
    { value: 'all', content: 'Все статусы' },
    { value: 'running', content: 'running' },
    { value: 'paused', content: 'paused' },
    { value: 'stopped', content: 'stopped' },
    { value: 'error', content: 'error' },
  ];

  return {
    nodes,
    loading,
    error,
    setError,
    showAdd,
    setShowAdd,
    editProxy,
    setEditProxy,
    copiedId,
    filterNodeId,
    setFilterNodeId,
    filterOptions,
    filterStatus,
    setFilterStatus,
    statusOptions,
    filterTags,
    setFilterTags,
    allProxies,
    totalProxies,
    loadData,
    handleDelete,
    handleCopyLink,
    selectedKeys,
    toggleSelect,
    selectAllVisible,
    clearSelection,
  };
}
