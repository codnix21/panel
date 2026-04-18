import { useState, useEffect } from 'react';
import { Card, Loader, Button } from '@gravity-ui/uikit';
import { getAuditLog, AuditLogRow } from '../../api';
import s from './Audit.module.scss';

export default function Audit() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = async (nextOffset: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await getAuditLog({ limit, offset: nextOffset });
      setRows(data);
      setOffset(nextOffset);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(0);
  }, []);

  return (
    <>
      <h2 className={s.title}>Журнал аудита</h2>
      <p className={s.subtitle}>Входы, изменения нод и прокси, смена токена.</p>

      {error && <div className={s.error}>{error}</div>}

      <Card view="outlined" className={s.card}>
        {loading ? (
          <div className={s.loader}><Loader size="l" /></div>
        ) : rows.length === 0 ? (
          <p className={s.empty}>Записей пока нет.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Действие</th>
                  <th>Ресурс</th>
                  <th>Пользователь</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.created_at).toLocaleString('ru-RU')}</td>
                    <td><code>{r.action}</code></td>
                    <td>
                      {r.resource_type && r.resource_id
                        ? `${r.resource_type} #${r.resource_id}`
                        : '—'}
                    </td>
                    <td>{r.username || '—'}</td>
                    <td>{r.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={s.pager}>
          <Button
            size="s"
            view="outlined"
            disabled={offset === 0 || loading}
            onClick={() => load(Math.max(0, offset - limit))}
          >
            Назад
          </Button>
          <Button
            size="s"
            view="outlined"
            disabled={rows.length < limit || loading}
            onClick={() => load(offset + limit)}
          >
            Дальше
          </Button>
        </div>
      </Card>
    </>
  );
}
