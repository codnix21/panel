import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Loader, Label, Alert, TextArea, Dialog, TextInput } from '@gravity-ui/uikit';
import AddProxyDialog from '../../components/AddProxyDialog';
import EditProxyDialog from '../../components/EditProxyDialog';
import ProxyCard from '../../components/ProxyCard';
import FlagIcon from '../../components/FlagIcon';
import CopyValueButton from '../../components/CopyValueButton';
import { rotateNodeToken } from '../../api';
import { useNodeDetail } from '../../hooks/useNodeDetail';
import s from './NodeDetail.module.scss';

export default function NodeDetail() {
  const navigate = useNavigate();
  const [rotateOpen, setRotateOpen] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [rotateHint, setRotateHint] = useState('');
  const [rotateLoading, setRotateLoading] = useState(false);
  const {
    nodeId, node, proxies, loading, error, setError,
    showAdd, setShowAdd, editProxy, setEditProxy, copiedId,
    domainsText, setDomainsText, domainsLoading, domainsSaving, domainsLoaded,
    blacklistText, setBlacklistText, blacklistLoading, blacklistSaving, blacklistLoaded,
    nodeGeo,     loadData, handleDelete, handleCopyLink, handleSaveDomains, handleSaveBlacklist,
  } = useNodeDetail();

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
