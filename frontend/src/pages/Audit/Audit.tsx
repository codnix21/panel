import { useState, useEffect } from 'react';
import { Card, Loader, Button, TextInput } from '@gravity-ui/uikit';
import { getAuditLog, downloadAuditCsv, AuditLogRow } from '../../api';
import s from './Audit.module.scss';

const limit = 50;

export default function Audit() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  const fetchPage = async (nextOffset: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await getAuditLog({
        limit,
        offset: nextOffset,
        action: actionFilter.trim() || undefined,
        from: fromFilter.trim() || undefined,
        to: toFilter.trim() || undefined,
      });
      setRows(data.rows);
      setTotal(data.total);
      setOffset(nextOffset);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getAuditLog({ limit, offset: 0 });
        setRows(data.rows);
        setTotal(data.total);
        setOffset(0);
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleApply = () => {
    void fetchPage(0);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      await downloadAuditCsv({
        action: actionFilter.trim() || undefined,
        from: fromFilter.trim() || undefined,
        to: toFilter.trim() || undefined,
      });
    } catch (e: any) {
      setError(e.message || 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  const canNext = offset + limit < total;
  const rangeLabel =
    total === 0 ? '0 записей' : `${offset + 1}–${Math.min(offset + rows.length, offset + limit)} из ${total}`;

  return (
    <>
      <h2 className={s.title}>Журнал аудита</h2>
      <p className={s.subtitle}>Входы, изменения нод и прокси, смена токена.</p>

      <div className={s.filters}>
        <TextInput
          value={actionFilter}
          onUpdate={setActionFilter}
          placeholder="Действие (точное, напр. auth.login)"
          size="l"
        />
        <TextInput
          value={fromFilter}
          onUpdate={setFromFilter}
          placeholder="С даты (ISO, напр. 2025-01-01T00:00:00Z)"
          size="l"
        />
        <TextInput
          value={toFilter}
          onUpdate={setToFilter}
          placeholder="По дату (ISO)"
          size="l"
        />
        <Button view="action" onClick={handleApply}>
          Применить
        </Button>
      </div>

      <div className={s.toolbar}>
        <Button view="outlined" loading={exporting} onClick={handleExportCsv}>
          Экспорт CSV (до 10 000, с учётом фильтров)
        </Button>
        <span className={s.range}>{rangeLabel}</span>
      </div>

      {error && <div className={s.error}>{error}</div>}

      <Card view="outlined" className={s.card}>
        {loading ? (
          <div className={s.loader}><Loader size="l" /></div>
        ) : rows.length === 0 ? (
          <p className={s.empty}>Записей нет.</p>
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
            onClick={() => void fetchPage(Math.max(0, offset - limit))}
          >
            Назад
          </Button>
          <Button
            size="s"
            view="outlined"
            disabled={!canNext || loading}
            onClick={() => void fetchPage(offset + limit)}
          >
            Дальше
          </Button>
        </div>
      </Card>
    </>
  );
}
