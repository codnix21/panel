import { useState, useMemo, useCallback } from 'react';
import { Button, Loader, Alert, Select, TextInput, Dialog } from '@gravity-ui/uikit';
import EditProxyDialog from '../../components/EditProxyDialog';
import ProxyCard from '../../components/ProxyCard';
import AddProxyDialog from '../../components/AddProxyDialog';
import { useProxies } from '../../hooks/useProxies';
import { batchProxyActions, batchProxyDomain, downloadNodesCsv, downloadProxiesCsv } from '../../api';
import s from './Proxies.module.scss';

type BatchKind = 'pause' | 'unpause' | 'restart' | 'domain';

export default function Proxies() {
  const {
    nodes, loading, error, setError,
    showAdd, setShowAdd, editProxy, setEditProxy, copiedId,
    filterNodeId, setFilterNodeId, filterOptions,
    filterStatus, setFilterStatus, statusOptions,
    filterTags, setFilterTags,
    allProxies, totalProxies,
    loadData, handleDelete, handleCopyLink,
    selectedKeys, toggleSelect, selectAllVisible, clearSelection,
  } = useProxies();

  const [batchDomain, setBatchDomain] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<BatchKind | null>(null);
  const [exporting, setExporting] = useState(false);

  const selectedList = useMemo(
    () => allProxies.filter((p) => selectedKeys.has(`${p.nodeId}:${p.id}`)),
    [allProxies, selectedKeys]
  );

  const openConfirm = (kind: BatchKind) => {
    if (selectedList.length === 0) {
      setError('Отметьте прокси чекбоксами');
      return;
    }
    if (kind === 'domain' && !batchDomain.trim()) {
      setError('Укажите новый SNI / домен для массовой смены');
      return;
    }
    setPendingKind(kind);
    setConfirmOpen(true);
  };

  const executeBatch = useCallback(async () => {
    if (!pendingKind || selectedList.length === 0) return;
    setBatchLoading(true);
    setError('');
    const byNode = new Map<number, string[]>();
    for (const p of selectedList) {
      if (!byNode.has(p.nodeId)) byNode.set(p.nodeId, []);
      byNode.get(p.nodeId)!.push(p.id);
    }
    try {
      let failed = 0;
      let ok = 0;
      for (const [nodeId, ids] of byNode) {
        if (pendingKind === 'domain') {
          const r = await batchProxyDomain(nodeId, ids, batchDomain.trim());
          for (const x of r.results) {
            if (x.ok) ok += 1;
            else failed += 1;
          }
        } else {
          const r = await batchProxyActions(nodeId, pendingKind, ids);
          for (const x of r.results) {
            if (x.ok) ok += 1;
            else failed += 1;
          }
        }
      }
      if (failed > 0) {
        setError(`Частично выполнено: успешно ${ok}, ошибок ${failed}. Проверьте ноды и журнал.`);
      }
      clearSelection();
      setConfirmOpen(false);
      setPendingKind(null);
      loadData();
    } catch (e: any) {
      setError(e.message || 'Ошибка массовой операции');
    } finally {
      setBatchLoading(false);
    }
  }, [pendingKind, selectedList, batchDomain, clearSelection, loadData, setError]);

  const confirmTitle =
    pendingKind === 'domain'
      ? 'Сменить SNI для выбранных?'
      : pendingKind === 'restart'
        ? 'Перезапустить выбранные прокси?'
        : pendingKind === 'pause'
          ? 'Поставить на паузу выбранные?'
          : pendingKind === 'unpause'
            ? 'Запустить выбранные прокси?'
            : '';

  const handleExportNodes = async () => {
    setExporting(true);
    try {
      await downloadNodesCsv();
    } catch (e: any) {
      setError(e.message || 'Экспорт');
    } finally {
      setExporting(false);
    }
  };

  const handleExportProxies = async () => {
    setExporting(true);
    try {
      await downloadProxiesCsv();
    } catch (e: any) {
      setError(e.message || 'Экспорт');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className={s.header}>
        <div className={s.headerLeft}>
          <h2>Прокси ({totalProxies})</h2>
          {nodes.length > 1 && (
            <Select
              value={[filterNodeId]}
              onUpdate={(v) => setFilterNodeId(v[0] || 'all')}
              options={filterOptions}
              width={220}
            />
          )}
          <Select
            value={[filterStatus]}
            onUpdate={(v) => setFilterStatus(v[0] || 'all')}
            options={statusOptions}
            width={180}
          />
          <TextInput
            value={filterTags}
            onUpdate={setFilterTags}
            placeholder="Теги (через запятую)"
            size="l"
          />
        </div>
        <div className={s.headerActions}>
          <Button view="outlined" size="s" loading={exporting} onClick={handleExportNodes}>
            CSV ноды
          </Button>
          <Button view="outlined" size="s" loading={exporting} onClick={handleExportProxies}>
            CSV прокси
          </Button>
          <Button view="action" onClick={() => setShowAdd(true)}>+ Добавить прокси</Button>
        </div>
      </div>

      {selectedKeys.size > 0 && (
        <div className={s.batchBar}>
          <span className={s.batchCount}>Выбрано: {selectedKeys.size}</span>
          <Button size="s" view="outlined" onClick={selectAllVisible}>
            Выбрать все на экране
          </Button>
          <Button size="s" view="outlined" onClick={clearSelection}>
            Снять выбор
          </Button>
          <Button size="s" view="outlined" loading={batchLoading} onClick={() => openConfirm('pause')}>
            Пауза
          </Button>
          <Button size="s" view="outlined" loading={batchLoading} onClick={() => openConfirm('unpause')}>
            Старт
          </Button>
          <Button size="s" view="outlined" loading={batchLoading} onClick={() => openConfirm('restart')}>
            Перезапуск
          </Button>
          <TextInput
            value={batchDomain}
            onUpdate={setBatchDomain}
            placeholder="Новый SNI"
            size="m"
          />
          <Button size="s" view="action" loading={batchLoading} onClick={() => openConfirm('domain')}>
            Сменить домен
          </Button>
        </div>
      )}

      {error && (
        <div className={s.errorWrap}>
          <Alert theme="danger" message={error} onClose={() => setError('')} />
        </div>
      )}

      <Dialog open={confirmOpen} onClose={() => !batchLoading && setConfirmOpen(false)} size="l">
        <Dialog.Header caption={confirmTitle} />
        <Dialog.Body>
          <p className={s.confirmHint}>
            {pendingKind === 'domain' && (
              <>Новый домен (SNI): <strong>{batchDomain.trim()}</strong></>
            )}
            {pendingKind !== 'domain' && <>Операция: <code>{pendingKind}</code></>}
          </p>
          <ul className={s.confirmList}>
            {selectedList.slice(0, 40).map((p) => (
              <li key={`${p.nodeId}:${p.id}`}>
                <code>{p.id}</code> — {p.name || '—'} — {p.nodeName}
              </li>
            ))}
            {selectedList.length > 40 && <li>… и ещё {selectedList.length - 40}</li>}
          </ul>
        </Dialog.Body>
        <Dialog.Footer
          onClickButtonApply={executeBatch}
          onClickButtonCancel={() => !batchLoading && setConfirmOpen(false)}
          textButtonApply="Подтвердить"
          textButtonCancel="Отмена"
          loading={batchLoading}
        />
      </Dialog>

      {loading ? (
        <div className={s.loader}><Loader size="l" /></div>
      ) : allProxies.length === 0 ? (
        <div className={s.empty}>
          <p>Прокси не найдены (проверьте фильтры).</p>
          <p>Добавьте прокси или смените ноду / статус / теги.</p>
        </div>
      ) : (
        <div className={s.grid}>
          {allProxies.map((proxy) => (
            <ProxyCard
              key={`${proxy.nodeId}-${proxy.id}`}
              proxy={proxy}
              nodeId={proxy.nodeId}
              nodeName={proxy.nodeName}
              copied={copiedId === proxy.id}
              selectionMode
              selected={selectedKeys.has(`${proxy.nodeId}:${proxy.id}`)}
              onToggleSelect={() => toggleSelect(proxy.nodeId, proxy.id)}
              onEdit={() => setEditProxy({ proxy, nodeId: proxy.nodeId })}
              onDelete={() => handleDelete(proxy.nodeId, proxy.id)}
              onCopyLink={() => handleCopyLink(proxy.nodeId, proxy.id)}
              onStatusChange={loadData}
            />
          ))}
        </div>
      )}

      <AddProxyDialog open={showAdd} onClose={() => setShowAdd(false)} nodes={nodes} onCreated={() => { setShowAdd(false); loadData(); }} />

      {editProxy && (
        <EditProxyDialog open={!!editProxy} onClose={() => setEditProxy(null)} nodeId={editProxy.nodeId} proxy={editProxy.proxy} onUpdated={() => { setEditProxy(null); loadData(); }} />
      )}
    </>
  );
}
