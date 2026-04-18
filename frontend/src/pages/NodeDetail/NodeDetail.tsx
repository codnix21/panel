import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Loader, Label, Alert, TextArea, Dialog, TextInput } from '@gravity-ui/uikit';
import AddProxyDialog from '../../components/AddProxyDialog';
import EditProxyDialog from '../../components/EditProxyDialog';
import ProxyCard from '../../components/ProxyCard';
import FlagIcon from '../../components/FlagIcon';
import CopyValueButton from '../../components/CopyValueButton';
import { rotateNodeToken, batchProxyActions, batchProxyDomain, getNodeInfo } from '../../api';
import { useNodeDetail } from '../../hooks/useNodeDetail';
import s from './NodeDetail.module.scss';

export default function NodeDetail() {
  const navigate = useNavigate();
  const [rotateOpen, setRotateOpen] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [rotateHint, setRotateHint] = useState('');
  const [rotateLoading, setRotateLoading] = useState(false);
  const [batchIds, setBatchIds] = useState('');
  const [batchDomain, setBatchDomain] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [pendingBatch, setPendingBatch] = useState<'pause' | 'unpause' | 'restart' | 'domain' | null>(null);
  const [imgInfo, setImgInfo] = useState<string>('');
  const {
    nodeId, node, proxies, loading, error, setError,
    showAdd, setShowAdd, editProxy, setEditProxy, copiedId,
    domainsText, setDomainsText, domainsLoading, domainsSaving, domainsLoaded,
    blacklistText, setBlacklistText, blacklistLoading, blacklistSaving, blacklistLoaded,
    nodeGeo,     loadData, handleDelete, handleCopyLink, handleSaveDomains, handleSaveBlacklist,
  } = useNodeDetail();

  useEffect(() => {
    if (!nodeId) return;
    getNodeInfo(nodeId)
      .then((info) => {
        const parts: string[] = [];
        if (info.images?.proxyImage?.id) {
          parts.push(`telemt-образ: ${info.images.proxyImage.id}`);
        }
        if (info.images?.nginx?.imageId) {
          parts.push(`nginx: ${info.images.nginx.imageName} (${info.images.nginx.imageId})`);
        }
        setImgInfo(parts.join(' · '));
      })
      .catch(() => setImgInfo(''));
  }, [nodeId]);

  const parseBatchIds = () =>
    batchIds
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const openBatchConfirm = (kind: 'pause' | 'unpause' | 'restart' | 'domain') => {
    const ids = parseBatchIds();
    if (ids.length === 0) {
      setError('Укажите ID прокси через запятую');
      return;
    }
    if (kind === 'domain' && !batchDomain.trim()) {
      setError('Укажите новый домен (SNI)');
      return;
    }
    setPendingBatch(kind);
    setBatchConfirmOpen(true);
  };

  const executeBatch = async () => {
    if (!pendingBatch) return;
    const ids = parseBatchIds();
    if (ids.length === 0) {
      setBatchConfirmOpen(false);
      return;
    }
    setBatchLoading(true);
    setError('');
    try {
      let failed = 0;
      let ok = 0;
      if (pendingBatch === 'domain') {
        const r = await batchProxyDomain(nodeId, ids, batchDomain.trim());
        for (const x of r.results) {
          if (x.ok) ok += 1;
          else failed += 1;
        }
      } else {
        const r = await batchProxyActions(nodeId, pendingBatch, ids);
        for (const x of r.results) {
          if (x.ok) ok += 1;
          else failed += 1;
        }
      }
      if (failed > 0) {
        setError(`Частично: успешно ${ok}, ошибок ${failed}`);
      }
      setBatchConfirmOpen(false);
      setPendingBatch(null);
      loadData();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleRotateToken = async () => {
    setRotateLoading(true);
    setNewToken('');
    setRotateHint('');
    try {
      const data = await rotateNodeToken(nodeId);
      setNewToken(data.token);
      setRotateHint(data.hint);
      loadData();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    } finally {
      setRotateLoading(false);
    }
  };

  if (loading) {
    return <div className={s.loader}><Loader size="l" /></div>;
  }

  return (
    <>
      <div className={s.header}>
        <Button view="flat" onClick={() => navigate('/nodes')}>← Назад</Button>
        {node && (
          <>
            <h2 className={s.nameRow}>{nodeGeo && <FlagIcon code={nodeGeo} />}{node.name}</h2>
            <Label theme="info">{node.ip}:{node.port}</Label>
            {node.last_seen_at ? (
              <Label theme="success" size="s">
                ответ панели: {new Date(node.last_seen_at).toLocaleString('ru-RU')}
              </Label>
            ) : (
              <Label theme="warning" size="s">ещё не было успешного ответа</Label>
            )}
            {imgInfo && (
              <span className={s.imageHint} title={imgInfo}>
                {imgInfo}
              </span>
            )}
            <Button view="outlined" onClick={() => { setRotateOpen(true); setNewToken(''); setRotateHint(''); }}>
              Сменить токен API
            </Button>
          </>
        )}
      </div>

      <Dialog open={rotateOpen} onClose={() => setRotateOpen(false)} size="l">
        <Dialog.Header caption="Смена токена ноды" />
        <Dialog.Body>
          <p className={s.rotateIntro}>
            Новый токен сохранится в панели. На сервере ноды обновите <code>AUTH_TOKEN</code> в <code>.env</code> и перезапустите контейнеры.
          </p>
          {!newToken ? (
            <Button view="action" loading={rotateLoading} onClick={handleRotateToken}>
              Сгенерировать и сохранить
            </Button>
          ) : (
            <>
              <div className={s.rotateField}>
                <label>Новый токен (скопируйте сейчас)</label>
                <div className={s.rotateInputRow}>
                  <TextInput value={newToken} size="l" disabled className={s.rotateInput} />
                  <CopyValueButton value={newToken} title="Копировать токен" />
                </div>
              </div>
              {rotateHint && <p className={s.rotateHint}>{rotateHint}</p>}
            </>
          )}
        </Dialog.Body>
        <Dialog.Footer
          onClickButtonApply={() => setRotateOpen(false)}
          onClickButtonCancel={() => setRotateOpen(false)}
          textButtonApply="Закрыть"
          textButtonCancel="Отмена"
        />
      </Dialog>

      {error && (
        <div className={s.errorWrap}>
          <Alert theme="danger" message={error} onClose={() => setError('')} />
        </div>
      )}

      <div className={s.proxiesHeader}>
        <h3>Прокси ({proxies.length})</h3>
        <Button view="action" onClick={() => setShowAdd(true)}>+ Добавить прокси</Button>
      </div>

      {proxies.length > 0 && (
        <Card view="outlined" className={s.batchCard}>
          <h4>Массовые действия</h4>
          <p className={s.batchHint}>
            Укажите ID прокси через запятую (как в карточке или URL). Пауза / старт / перезапуск — на выбранных;
            смена SNI — общий домен для всех указанных.
          </p>
          <TextInput value={batchIds} onUpdate={setBatchIds} placeholder="id1, id2, …" size="m" />
          <div className={s.batchRow}>
            <Button size="s" view="outlined" loading={batchLoading} onClick={() => openBatchConfirm('pause')}>Пауза</Button>
            <Button size="s" view="outlined" loading={batchLoading} onClick={() => openBatchConfirm('unpause')}>Старт</Button>
            <Button size="s" view="outlined" loading={batchLoading} onClick={() => openBatchConfirm('restart')}>Перезапуск</Button>
          </div>
          <div className={s.batchRow}>
            <TextInput value={batchDomain} onUpdate={setBatchDomain} placeholder="Новый SNI домен" size="m" />
            <Button size="s" view="action" loading={batchLoading} onClick={() => openBatchConfirm('domain')}>
              Сменить домен
            </Button>
          </div>
        </Card>
      )}

      <Dialog open={batchConfirmOpen} onClose={() => !batchLoading && setBatchConfirmOpen(false)} size="l">
        <Dialog.Header
          caption={
            pendingBatch === 'domain'
              ? 'Подтвердить смену SNI'
              : pendingBatch === 'restart'
                ? 'Подтвердить перезапуск'
                : 'Подтвердить действие'
          }
        />
        <Dialog.Body>
          <p className={s.batchConfirmPreview}>
            {pendingBatch === 'domain' && (
              <>Новый домен: <strong>{batchDomain.trim()}</strong></>
            )}
            {pendingBatch && pendingBatch !== 'domain' && (
              <>Действие: <code>{pendingBatch}</code></>
            )}
          </p>
          <p className={s.batchHint}>ID ({parseBatchIds().length}):</p>
          <pre className={s.batchIdPreview}>{parseBatchIds().join(', ')}</pre>
        </Dialog.Body>
        <Dialog.Footer
          onClickButtonApply={executeBatch}
          onClickButtonCancel={() => !batchLoading && setBatchConfirmOpen(false)}
          textButtonApply="Выполнить"
          textButtonCancel="Отмена"
          loading={batchLoading}
        />
      </Dialog>

      {proxies.length === 0 ? (
        <div className={s.empty}>
          <p>На этой ноде пока нет прокси.</p>
          <p>Нажмите "Добавить прокси" для создания.</p>
        </div>
      ) : (
        <div className={s.proxyGrid}>
          {proxies.map((proxy) => (
            <ProxyCard
              key={proxy.id}
              proxy={proxy}
              nodeId={nodeId}
              copied={copiedId === proxy.id}
              onEdit={() => setEditProxy(proxy)}
              onDelete={() => handleDelete(proxy.id)}
              onCopyLink={() => handleCopyLink(proxy.id)}
              onStatusChange={loadData}
            />
          ))}
        </div>
      )}

      <div className={s.section}>
        <h3>Словарь доменов</h3>
        <Card view="outlined" className={s.sectionCard}>
          <p className={s.sectionHint}>По одному домену на строку. Если список пуст — используется набор по умолчанию.</p>
          {domainsLoading ? <Loader size="s" /> : (
            <>
              <TextArea value={domainsText} onUpdate={setDomainsText} rows={10} placeholder={'www.google.com\nfonts.googleapis.com\ncdn.jsdelivr.net'} size="m" />
              <div className={s.saveRow}>
                <Button view="action" size="s" loading={domainsSaving} onClick={handleSaveDomains} disabled={!domainsLoaded}>Сохранить</Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className={s.sectionBlacklist}>
        <h3>Чёрный список IP</h3>
        <Card view="outlined" className={s.sectionCard}>
          <p className={s.sectionHint}>По одному IP на строку. Заблокированные IP не смогут подключиться ни к одному прокси ноды.</p>
          {blacklistLoading ? <Loader size="s" /> : (
            <>
              <TextArea value={blacklistText} onUpdate={setBlacklistText} rows={6} placeholder={'1.2.3.4\n5.6.7.8'} size="m" />
              <div className={s.saveRow}>
                <Button view="action" size="s" loading={blacklistSaving} onClick={handleSaveBlacklist} disabled={!blacklistLoaded}>Сохранить</Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <AddProxyDialog open={showAdd} onClose={() => setShowAdd(false)} nodeId={nodeId} onCreated={() => { setShowAdd(false); loadData(); }} />

      {editProxy && (
        <EditProxyDialog open={!!editProxy} onClose={() => setEditProxy(null)} nodeId={nodeId} proxy={editProxy} onUpdated={() => { setEditProxy(null); loadData(); }} />
      )}
    </>
  );
}
