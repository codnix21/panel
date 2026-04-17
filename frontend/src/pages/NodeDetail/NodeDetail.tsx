import { useNavigate } from 'react-router-dom';
import { Button, Card, Loader, Label, Alert, TextArea } from '@gravity-ui/uikit';
import AddProxyDialog from '../../components/AddProxyDialog';
import EditProxyDialog from '../../components/EditProxyDialog';
import ProxyCard from '../../components/ProxyCard';
import FlagIcon from '../../components/FlagIcon';
import { useNodeDetail } from '../../hooks/useNodeDetail';
import s from './NodeDetail.module.scss';

export default function NodeDetail() {
  const navigate = useNavigate();
  const {
    nodeId, node, proxies, loading, error, setError,
    showAdd, setShowAdd, editProxy, setEditProxy, copiedId,
    domainsText, setDomainsText, domainsLoading, domainsSaving, domainsLoaded,
    blacklistText, setBlacklistText, blacklistLoading, blacklistSaving, blacklistLoaded,
    nodeGeo, loadData, handleDelete, handleCopyLink, handleSaveDomains, handleSaveBlacklist,
  } = useNodeDetail();

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
          </>
        )}
      </div>

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
