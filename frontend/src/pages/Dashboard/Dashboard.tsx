import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Loader, Label, Button, Alert } from '@gravity-ui/uikit';
import { getDashboardSummary, type DashboardSummary } from '../../api';
import s from './Dashboard.module.scss';

function formatSeen(iso: string | null | undefined, staleMs: number): string {
  if (!iso) return 'никогда';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff > staleMs) return `давно (${d.toLocaleString('ru-RU')})`;
  return d.toLocaleString('ru-RU');
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboardSummary()
      .then(setData)
      .catch((e) => setError(e.message || 'Ошибка'));
  }, []);

  if (error) {
    return <div className={s.err}>{error}</div>;
  }
  if (!data) {
    return (
      <div className={s.loader}>
        <Loader size="l" />
      </div>
    );
  }

  const staleMs = data.healthStaleAfterMs ?? 120000;

  return (
    <>
      <h2 className={s.title}>Сводка</h2>

      {data.showImageUpdateBanner && (
        <Alert
          theme="warning"
          title="Образы нод"
          message={
            <>
              Заданы эталонные подстроки (
              {data.expectedProxyImageRef && (
                <>
                  прокси: <code>{data.expectedProxyImageRef}</code>
                  {data.expectedNginxImageRef ? '; ' : ''}
                </>
              )}
              {data.expectedNginxImageRef && (
                <>
                  nginx: <code>{data.expectedNginxImageRef}</code>
                </>
              )}
              ). У части нод версии не совпадают — см. таблицу ниже.
            </>
          }
          className={s.banner}
        />
      )}

      <div className={s.stats}>
        <Card view="outlined" className={s.statCard}>
          <div className={s.statNum}>{data.nodeCount}</div>
          <div className={s.statLabel}>нод</div>
        </Card>
        <Card view="outlined" className={s.statCard}>
          <div className={s.statNum}>{data.proxyTotal}</div>
          <div className={s.statLabel}>прокси всего</div>
        </Card>
        <Card view="outlined" className={s.statCard}>
          <div className={s.statNum}>{data.runningCount}</div>
          <div className={s.statLabel}>в статусе running</div>
        </Card>
        <Card view="outlined" className={s.statCard}>
          <div className={s.statNum}>{data.failedLogins24h}</div>
          <div className={s.statLabel}>неудачных входов за 24ч</div>
        </Card>
      </div>

      {data.healthPollIntervalMs != null && (
        <p className={s.metaLine}>
          Опрос нод: каждые {Math.round(data.healthPollIntervalMs / 1000)} с; «давно» если нет ответа дольше{' '}
          {Math.round(staleMs / 1000)} с.
        </p>
      )}

      <Card view="outlined" className={s.card}>
        <h3>Ноды</h3>
        <div className={s.nodeList}>
          {data.nodes.length === 0 ? (
            <p className={s.muted}>Ноды не добавлены.</p>
          ) : (
            data.nodes.map((n) => (
              <div key={n.id} className={s.nodeRow}>
                <Button view="flat" onClick={() => navigate(`/nodes/${n.id}`)}>
                  {n.name}
                </Button>
                <span className={s.muted}>{n.ip}</span>
                <Label theme={n.last_seen_at ? 'success' : 'warning'} size="xs">
                  ответ: {formatSeen(n.last_seen_at, staleMs)}
                </Label>
              </div>
            ))
          )}
        </div>
      </Card>

      {data.nodeImageHints && data.nodeImageHints.length > 0 && (
        <Card view="outlined" className={s.card}>
          <h3>Версии образов (по данным нод)</h3>
          <div className={s.tableWrap}>
            <table className={s.imgTable}>
              <thead>
                <tr>
                  <th>Нода</th>
                  <th>Прокси-образ</th>
                  <th>Nginx</th>
                </tr>
              </thead>
              <tbody>
                {data.nodeImageHints.map((h) => (
                  <tr key={h.nodeId}>
                    <td>
                      <Button view="flat" size="s" onClick={() => navigate(`/nodes/${h.nodeId}`)}>
                        {h.nodeName}
                      </Button>
                    </td>
                    <td>
                      {h.error ? (
                        <span className={s.muted}>{h.error}</span>
                      ) : (
                        <>
                          <span className={h.proxyMismatch ? s.warnText : ''}>{h.proxyImage || '—'}</span>
                          {h.proxyMismatch && <Label theme="warning" size="xs">обновить?</Label>}
                        </>
                      )}
                    </td>
                    <td>
                      {h.error ? (
                        '—'
                      ) : (
                        <>
                          <span className={h.nginxMismatch ? s.warnText : ''}>{h.nginxImage || '—'}</span>
                          {h.nginxMismatch && <Label theme="warning" size="xs">обновить?</Label>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card view="outlined" className={s.card}>
        <h3>Последние события (аудит)</h3>
        <div className={s.audit}>
          {data.recentAudit.map((a) => (
            <div key={a.id} className={s.auditRow}>
              <span className={s.auditTime}>{new Date(a.created_at).toLocaleString('ru-RU')}</span>
              <code>{a.action}</code>
              <span className={s.muted}>{a.username || '—'}</span>
            </div>
          ))}
        </div>
        <Button view="flat" onClick={() => navigate('/audit')}>
          Весь аудит →
        </Button>
      </Card>
    </>
  );
}
