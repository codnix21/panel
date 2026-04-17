import { useState, useEffect } from 'react';
import { getNodes, deleteNode, checkNodeHealth, updateNodeService, getProxies, NodeData, ProxyData } from '../api';

export function useNodes() {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [healthMap, setHealthMap] = useState<Record<number, boolean | null>>({});
  const [updatingMap, setUpdatingMap] = useState<Record<number, boolean>>({});
  const [proxiesMap, setProxiesMap] = useState<Record<number, ProxyData[]>>({});
  const [geoMap, setGeoMap] = useState<Record<string, string>>({});

  const lookupNodeGeo = async (nodeList: NodeData[]) => {
    const ips = nodeList.map((n) => n.ip).filter((ip) => !geoMap[ip]);
    if (ips.length === 0) return;
    try {
      const resp = await fetch('http://ip-api.com/batch?fields=query,countryCode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ips.map((ip) => ({ query: ip }))),
      });
      if (resp.ok) {
        const data = await resp.json() as Array<{ query: string; countryCode?: string }>;
        const map: Record<string, string> = {};
        for (const entry of data) {
          if (entry.countryCode) map[entry.query] = entry.countryCode;
        }
        setGeoMap((prev) => ({ ...prev, ...map }));
      }
    } catch {}
  };

  const loadAllProxies = async (nodeList: NodeData[]) => {
    await Promise.all(
      nodeList.map(async (node) => {
        try {
          const proxies = await getProxies(node.id);
          setProxiesMap((prev) => ({ ...prev, [node.id]: proxies }));
        } catch {
          setProxiesMap((prev) => ({ ...prev, [node.id]: [] }));
        }
      }),
    );
  };

  const checkAllHealth = async (nodeList: NodeData[]) => {
    const map: Record<number, boolean | null> = {};
    nodeList.forEach((n) => (map[n.id] = null));
    setHealthMap(map);

    await Promise.all(
      nodeList.map(async (node) => {
        try {
          const { online } = await checkNodeHealth(node.id);
          setHealthMap((prev) => ({ ...prev, [node.id]: online }));
        } catch {
          setHealthMap((prev) => ({ ...prev, [node.id]: false }));
        }
      }),
    );
  };

  const loadNodes = async () => {
    try {
      const data = await getNodes();
      setNodes(data);
      checkAllHealth(data);
      loadAllProxies(data);
      lookupNodeGeo(data);
    } catch (err) {
      console.error('Failed to load nodes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNodes();
  }, []);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Удалить эту ноду?')) return;
    try {
      await deleteNode(id);
      setNodes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to delete node:', err);
    }
  };

  const handleUpdate = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdatingMap((prev) => ({ ...prev, [id]: true }));
    try {
      await updateNodeService(id);
    } catch (err) {
      console.error('Failed to update node:', err);
    } finally {
      setUpdatingMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  return {
    nodes, loading, showAdd, setShowAdd,
    healthMap, updatingMap, proxiesMap, geoMap,
    loadNodes, handleDelete, handleUpdate,
  };
}
