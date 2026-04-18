import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextInput } from '@gravity-ui/uikit';
import { globalSearch } from '../api';
import s from './GlobalSearch.module.scss';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<{ id: number; name: string; ip: string }[]>([]);
  const [proxies, setProxies] = useState<{ nodeId: number; nodeName: string; proxy: { id: string; name?: string } }[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) {
        setNodes([]);
        setProxies([]);
        return;
      }
      setLoading(true);
      globalSearch(q.trim())
        .then((r) => {
          setNodes(r.nodes);
          setProxies(r.proxies);
        })
        .catch(() => {
          setNodes([]);
          setProxies([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const goNode = (id: number) => {
    navigate(`/nodes/${id}`);
    setOpen(false);
    setQ('');
  };

  const goProxy = (nodeId: number, proxyId: string) => {
    navigate(`/nodes/${nodeId}/proxy/${proxyId}`);
    setOpen(false);
    setQ('');
  };

  const hasResults = nodes.length > 0 || proxies.length > 0;

  return (
    <div className={s.wrap} ref={wrapRef}>
      <TextInput
        placeholder="Поиск нод / прокси…"
        value={q}
        onUpdate={setQ}
        onFocus={() => setOpen(true)}
        size="m"
        className={s.input}
      />
      {open && q.trim().length >= 2 && (
        <div className={s.dropdown}>
          {loading && <div className={s.hint}>Поиск…</div>}
          {!loading && !hasResults && <div className={s.hint}>Ничего не найдено</div>}
          {!loading &&
            nodes.map((n) => (
              <button key={`n-${n.id}`} type="button" className={s.item} onClick={() => goNode(n.id)}>
                <strong>Нода</strong> {n.name} <span className={s.sub}>{n.ip}</span>
              </button>
            ))}
          {!loading &&
            proxies.map((p) => (
              <button
                key={`p-${p.nodeId}-${p.proxy.id}`}
                type="button"
                className={s.item}
                onClick={() => goProxy(p.nodeId, p.proxy.id)}
              >
                <strong>Прокси</strong> {p.proxy.name || p.proxy.id}{' '}
                <span className={s.sub}>{p.nodeName}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
