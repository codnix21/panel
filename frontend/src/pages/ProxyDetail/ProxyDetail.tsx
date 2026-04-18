import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Loader, Label, Alert, Tooltip, Select, TextInput, Dialog } from '@gravity-ui/uikit';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  ConnectedIpInfo,
  getProxyLogs,
  getNodeNginxLogs,
  getNodeInfo,
  checkNodePort,
  getNodes,
  cloneProxy,
  getProxyPanelMeta,
  putProxyPanelMeta,
  type NodeData,
  type ContainerInspectSummary,
} from '../../api';
import FlagIcon from '../../components/FlagIcon';
import CopyValueButton from '../../components/CopyValueButton';

function maskVpnHost(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? `${u.pathname.slice(0, 32)}${u.pathname.length > 33 ? '…' : ''}` : '';
    return `${u.hostname}${path ? path : ''}`;
  } catch {
    return 'указана';
  }
}

function formatContainerSummary(c: ContainerInspectSummary | { status: string; running: false }): string {
  const parts = [`${c.status}`, c.running ? 'running' : 'stopped'];
  if ('exitCode' in c && c.exitCode != null && c.exitCode !== 0) parts.push(`exit ${c.exitCode}`);
  if ('error' in c && c.error) parts.push(c.error);
  return parts.join(' · ');
}
import { useProxyDetail } from '../../hooks/useProxyDetail';
import { buildChartOptions, buildChartData } from '../../utils/chart';
import s from './ProxyDetail.module.scss';

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend, Filler, zoomPlugin);

export default function ProxyDetail() {
  const navigate = useNavigate();
  const {
    nodeId, proxyId, node, proxy, containers, stats, statsHistory, ipHistory, blacklist,
    loading, error, setError, copied, togglingPause, clearing, nodeGeo, chartRef,
    connectedIpSet, statusTheme, statusLabel, tgLink,
    handleCopyLink, handleTogglePause, handleClearHistory,
  } = useProxyDetail();

  const [logTarget, setLogTarget] = useState<'proxy' | 'xray' | 'nginx'>('proxy');
  const [logTail, setLogTail] = useState('500');
  const [logsText, setLogsText] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsErr, setLogsErr] = useState('');
  const [tcpPort, setTcpPort] = useState('');
  const [tcpLoading, setTcpLoading] = useState(false);
  const [tcpResult, setTcpResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [nodesList, setNodesList] = useState<NodeData[]>([]);
  const [cloneTarget, setCloneTarget] = useState<string>('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsErr, setTagsErr] = useState('');

  useEffect(() => {
    if (!cloneOpen) return;
    getNodes()
      .then(setNodesList)
      .catch(() => setNodesList([]));
  }, [cloneOpen]);

  useEffect(() => {
    if (!proxyId) return;
    let cancelled = false;
    getProxyPanelMeta(nodeId, proxyId)
      .then((m) => {
        if (!cancelled) setTagsInput(m.tags.join(', '));
      })
      .catch(() => {
        if (!cancelled) setTagsInput('');
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId, proxyId]);

  const handleClone = async () => {
    if (!proxyId) return;
    const tid = parseInt(cloneTarget, 10);
    if (!Number.isFinite(tid)) {
      setError('Выберите ноду');
      return;
    }
    setCloneLoading(true);
    setError('');
    try {
      const p = await cloneProxy(nodeId, proxyId, { targetNodeId: tid });
      navigate(`/nodes/${tid}/proxy/${p.id}`);
      setCloneOpen(false);
    } catch (e: any) {
      setError(e.message || 'Ошибка клонирования');
    } finally {
      setCloneLoading(false);
    }
  };

  const handleSaveTags = async () => {
    if (!proxyId) return;
    setTagsErr('');
    setTagsLoading(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await putProxyPanelMeta(nodeId, proxyId, tags);
    } catch (e: any) {
      setTagsErr(e.message || 'Не удалось сохранить теги');
    } finally {
      setTagsLoading(false);
    }
  };

  useEffect(() => {
    if (!proxy || !nodeId) return;
    let cancelled = false;
    (async () => {
      try {
        const info = await getNodeInfo(nodeId);
        if (cancelled) return;
        const p = proxy.listenPort && proxy.listenPort > 0 ? proxy.listenPort : info.nginxPort;
        setTcpPort(String(p));
      } catch {
        if (!cancelled) setTcpPort(proxy.listenPort ? String(proxy.listenPort) : '443');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nodeId, proxy?.id, proxy?.listenPort]);

  const fetchLogs = useCallback(async () => {
    if (!proxyId) return;
    setLogsErr('');
    setLogsLoading(true);
    try {
      const tail = Math.min(Math.max(parseInt(logTail, 10) || 500, 1), 5000);
      if (logTarget === 'nginx') {
        const data = await getNodeNginxLogs(nodeId, tail);
        setLogsText(data.logs);
      } else {
        const data = await getProxyLogs(nodeId, proxyId, { target: logTarget, tail });
        setLogsText(data.logs);
      }
    } catch (e: any) {
      setLogsErr(e.message || 'Ошибка загрузки');
      setLogsText('');
    } finally {
      setLogsLoading(false);
    }
  }, [nodeId, proxyId, logTarget, logTail]);

  const handleTcpCheck = useCallback(async () => {
    const port = parseInt(tcpPort, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      setTcpResult({ ok: false, error: 'Некорректный порт' });
      return;
    }
    setTcpLoading(true);
    setTcpResult(null);
    try {
      const r = await checkNodePort(nodeId, port);
      setTcpResult({ ok: r.ok, error: r.error });
    } catch (e: any) {
      setTcpResult({ ok: false, error: e.message || 'Ошибка' });
    } finally {
      setTcpLoading(false);
    }
  }, [nodeId, tcpPort]);

  if (loading) {
    return <div className={s.loader}><Loader size="l" /></div>;
  }

  return (
    <>
      <div className={s.header}>
        <Button view="flat" onClick={() => navigate(`/nodes/${nodeId}`)}>← Назад</Button>
        {stats && (
          <>
            <h2 style={{ margin: 0 }}>{stats.id}</h2>
            <Label theme={statusTheme} size="s">{statusLabel}</Label>
          </>
        )}
        {node && (
          <Label theme="info" size="s">
            {nodeGeo && <FlagIcon code={nodeGeo} />}{node.name} ({node.ip})
          </Label>
        )}
        <Button view="outlined" size="s" onClick={() => { setCloneOpen(true); setCloneTarget(String(nodeId)); }}>
          Клонировать
        </Button>
      </div>

      <Dialog open={cloneOpen} onClose={() => setCloneOpen(false)} size="s">
        <Dialog.Header caption="Клонировать прокси" />
        <Dialog.Body>
          <p style={{ marginTop: 0, fontSize: 13, color: 'var(--g-color-text-secondary)' }}>
            Создаётся новый прокси с теми же настройками на выбранной ноде (новый секрет и контейнер).
          </p>
          <div className="dialog-field">
            <label>Целевая нода</label>
            <Select
              width="max"
              value={cloneTarget ? [cloneTarget] : []}
              onUpdate={(v) => setCloneTarget(v[0] || '')}
              options={nodesList.map((n) => ({ value: String(n.id), content: `${n.name} (${n.ip})` }))}
            />
          </div>
        </Dialog.Body>
        <Dialog.Footer
          onClickButtonApply={handleClone}
          onClickButtonCancel={() => setCloneOpen(false)}
          textButtonApply="Клонировать"
          textButtonCancel="Отмена"
          loading={cloneLoading}
        />
      </Dialog>

      {error && (
        <div className={s.errorWrap}>
          <Alert theme="danger" message={error} onClose={() => setError('')} />
        </div>
      )}

      {node && proxy && (
        <Card view="outlined" className={s.diagCard}>
          <h3>Теги и группы (панель)</h3>
          <p className={s.tagsHint}>Через запятую — для поиска и учёта в панели, на ноду не передаются.</p>
          {tagsErr && (
            <div className={s.errorWrap}>
              <Alert theme="danger" message={tagsErr} onClose={() => setTagsErr('')} />
            </div>
          )}
          <div className={s.tagsRow}>
            <TextInput
              value={tagsInput}
              onUpdate={setTagsInput}
              placeholder="prod, eu, team-a"
              size="l"
            />
            <Button view="action" loading={tagsLoading} onClick={handleSaveTags}>
              Сохранить теги
            </Button>
          </div>
        </Card>
      )}

      {node && proxy && (
        <Card view="outlined" className={s.diagCard}>
          <h3>Параметры подключения и VPN</h3>
          <div className={s.diagRow}>
            <div className={s.diagLabel}>IP сервера (в tg:// ссылке)</div>
            <div className={`${s.diagValue} ${s.diagValueRow}`}>
              <span>{node.ip}</span>
              <CopyValueButton value={node.ip} title="Копировать IP" />
            </div>
          </div>
          <div className={s.diagRow}>
            <div className={s.diagLabel}>Порт в ссылке</div>
            <div className={`${s.diagValue} ${s.diagValueRow}`}>
              <span>
                {proxy.listenPort != null && proxy.listenPort > 0
                  ? String(proxy.listenPort)
                  : 'из ссылки (на ноде это NGINX_PORT из .env, часто 443)'}
              </span>
              {proxy.listenPort != null && proxy.listenPort > 0 ? (
                <CopyValueButton value={String(proxy.listenPort)} title="Копировать порт" />
              ) : null}
            </div>
          </div>
          <div className={s.diagRow}>
            <div className={s.diagLabel}>Fake TLS (SNI)</div>
            <div className={`${s.diagValue} ${s.diagValueRow}`}>
              <span>{proxy.domain}</span>
              <CopyValueButton value={proxy.domain} title="Копировать домен" />
            </div>
          </div>
          <div className={s.diagRow}>
            <div className={s.diagLabel}>Ссылка tg://</div>
            <div className={`${s.diagValue} ${s.diagValueRow}`}>
              <span className={s.tgLinkWrap}>{tgLink || '…'}</span>
              <CopyValueButton value={tgLink} disabled={!tgLink} title="Копировать ссылку" />
            </div>
          </div>
          <div className={s.diagRow}>
            <div className={s.diagLabel}>VLESS-туннель до Telegram</div>
            <div className={s.diagValue}>
              {proxy.vpnSubscription
                ? `включён (подписка: ${maskVpnHost(proxy.vpnSubscription)})`
                : 'выключен — трафик идёт с IP ноды напрямую до DC'}
            </div>
          </div>
          {proxy.vpnContainerName && (
            <div className={s.diagRow}>
              <div className={s.diagLabel}>Контейнер xray</div>
              <div className={s.diagValue}>{proxy.vpnContainerName}</div>
            </div>
          )}
          {containers && (
            <>
              <div className={s.diagRow}>
                <div className={s.diagLabel}>Docker: прокси</div>
                <div className={s.diagValue}>{formatContainerSummary(containers.proxy)}</div>
              </div>
              {containers.xray && (
                <div className={s.diagRow}>
                  <div className={s.diagLabel}>Docker: xray</div>
                  <div className={s.diagValue}>{formatContainerSummary(containers.xray)}</div>
                </div>
              )}
            </>
          )}
          <div className={s.diagRow}>
            <div className={s.diagLabel}>TCP с панели до ноды</div>
            <div className={s.diagValue} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <TextInput value={tcpPort} onUpdate={setTcpPort} placeholder="443" size="s" style={{ width: 100 }} />
              <Button size="s" view="outlined" onClick={handleTcpCheck} loading={tcpLoading}>
                Проверить порт
              </Button>
              {tcpResult && (
                <Label theme={tcpResult.ok ? 'success' : 'danger'} size="s">
                  {tcpResult.ok ? 'порт открыт' : tcpResult.error || 'недоступен'}
                </Label>
              )}
            </div>
          </div>
          <div className={s.diagHint}>
            <strong>Зачем VLESS:</strong> если нода в регионе, где до Telegram DC нельзя достучаться напрямую (например РФ),
            подписка поднимает отдельный туннель на зарубежный сервер — иначе прокси не заработает.
            Если сервер уже «видит» Telegram без блокировок — поле подписки оставьте пустым.
            <br /><br />
            <strong>Если в Telegram не подключается:</strong> проверьте, что на ноде открыт порт из ссылки (firewall),
            контейнер прокси в статусе «работает», и при необходимости совпадает SNI-домен с маскировкой.
          </div>
        </Card>
      )}

      {node && proxy && (
        <Card view="outlined" className={s.logsCard}>
          <h3>Логи Docker</h3>
          <p className={s.logsExplain}>
            <strong>telemt</strong> пишет на <code>INFO</code> рукопожатия с дата-центрами Telegram (адреса вида{' '}
            <code>91.108…</code>, <code>149.154…</code>) и обслуживание соединений — строки вроде{' '}
            <code>RPC handshake OK</code> и <code>Idle writer refreshed</code> при нормальной работе ожидаемы.
            После обновления ноды бинарные префиксы Docker и ANSI-цвета в тексте убираются.
          </p>
          <div className={s.logsToolbar}>
            <div>
              <div className={s.diagLabel} style={{ marginBottom: 4 }}>Контейнер</div>
              <Select
                width="max"
                value={[logTarget]}
                onUpdate={(v) => setLogTarget((v[0] as 'proxy' | 'xray' | 'nginx') || 'proxy')}
                options={[
                  { value: 'proxy', content: 'Прокси (telemt)' },
                  { value: 'xray', content: 'VPN (xray)' },
                  { value: 'nginx', content: 'Nginx (вся нода)' },
                ]}
              />
            </div>
            <div className={s.logTailField}>
              <div className={s.diagLabel} style={{ marginBottom: 4 }}>Строк (tail)</div>
              <TextInput value={logTail} onUpdate={setLogTail} placeholder="500" size="m" />
            </div>
            <Button view="action" size="m" onClick={fetchLogs} loading={logsLoading}>
              Загрузить
            </Button>
          </div>
          {logsErr && (
            <div style={{ marginBottom: 8 }}>
              <Alert theme="danger" message={logsErr} />
            </div>
          )}
          {!proxy.vpnSubscription && logTarget === 'xray' && (
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--g-color-text-secondary)' }}>
              Для этого прокси не задана VPN-подписка — логов xray не будет.
            </div>
          )}
          {logsText ? (
            <pre className={s.logPre}>{logsText}</pre>
          ) : (
            !logsErr && (
              <div style={{ fontSize: 12, color: 'var(--g-color-text-secondary)' }}>
                Нажмите «Загрузить», чтобы получить последние строки лога с ноды.
              </div>
            )
          )}
        </Card>
      )}

      {stats && (
        <Card view="outlined" className={s.statsCard}>
          <h3>Статистика в реальном времени</h3>
          <div className={s.statsGrid}>
            <div className={s.statItem}><div className={s.statValue}>{stats.cpuPercent}</div><div className={s.statLabel}>CPU</div></div>
            <div className={s.statItem}><div className={s.statValue}>{stats.memoryUsage}</div><div className={s.statLabel}>Память</div></div>
            <div className={s.statItem}><div className={s.statValue}>{stats.networkRx}</div><div className={s.statLabel}>Вход</div></div>
            <div className={s.statItem}><div className={s.statValue}>{stats.networkTx}</div><div className={s.statLabel}>Исход</div></div>
            <div className={s.statItem}><div className={s.statValue}>{stats.uptime}</div><div className={s.statLabel}>Аптайм</div></div>
            <div className={s.statItem}><div className={s.statValue}>{stats.connectedIps?.length || 0}</div><div className={s.statLabel}>IP</div></div>
          </div>

          {stats.connectedIps && stats.connectedIps.length > 0 && (
            <div className={s.connectedSection}>
              <div className={s.connectedTitle}>Сейчас подключены:</div>
              <div className={s.connectedList}>
                {stats.connectedIps.map((info: ConnectedIpInfo) => (
                  <Label key={info.ip} size="xs" theme="success">
                    {info.countryCode && <FlagIcon code={info.countryCode} size={16} />}{info.ip}
                  </Label>
                ))}
              </div>
            </div>
          )}

          <div className={s.actions}>
            <Button view="action" size="s" onClick={handleCopyLink}>
              {copied ? '✓ Скопировано!' : 'Копировать ссылку'}
            </Button>
            {(stats.status === 'running' || stats.status === 'paused') && (
              <Button view="outlined" size="s" onClick={handleTogglePause} loading={togglingPause}>
                {stats.status === 'paused' ? 'Запустить' : 'Пауза'}
              </Button>
            )}
          </div>
        </Card>
      )}

      {statsHistory.length > 1 && (
        <Card view="outlined" className={s.chartCard}>
          <div className={s.chartHeader}>
            <h3>Статистика</h3>
            <div className={s.chartButtons}>
              <Button size="xs" view="outlined" onClick={() => chartRef.current?.resetZoom()}>Сбросить зум</Button>
              <Button size="xs" view="outlined-danger" onClick={handleClearHistory} loading={clearing}>Очистить историю</Button>
            </div>
          </div>
          <div className={s.chartHint}>Колёсико мыши — приближение, зажатая ЛКМ — прокрутка. Клик по легенде — скрыть/показать линию.</div>
          <div className={s.chartWrap}>
            <Line ref={chartRef} data={buildChartData(statsHistory)} options={buildChartOptions()} />
          </div>
        </Card>
      )}

      {ipHistory.length > 0 && (
        <Card view="outlined" className={s.ipCard}>
          <h3>История IP ({ipHistory.length})</h3>
          <div className={s.ipList}>
            {ipHistory.map((entry) => {
              const isConnected = connectedIpSet.has(entry.ip);
              const isBlacklisted = blacklist.has(entry.ip);
              const theme = isConnected ? 'success' : isBlacklisted ? 'danger' : 'info';
              const tooltipContent = (
                <div className={s.ipTooltip}>
                  {entry.country && <div>Страна: {entry.country}</div>}
                  <div>Первое подключение: {new Date(entry.firstSeen).toLocaleString('ru-RU')}</div>
                  <div>Последнее: {new Date(entry.lastSeen).toLocaleString('ru-RU')}</div>
                  {isBlacklisted && <div className={s.ipTooltipBlocked}>⛔ В чёрном списке</div>}
                </div>
              );
              return (
                <Tooltip key={entry.ip} content={tooltipContent} placement="top" openDelay={300}>
                  <div className={s.ipItem} tabIndex={0}>
                    <Label theme={theme} size="s">
                      {entry.countryCode && <FlagIcon code={entry.countryCode} size={16} />}{entry.ip}
                    </Label>
                  </div>
                </Tooltip>
              );
            })}
          </div>
          <div className={s.ipLegend}>
            <span><Label theme="success" size="xs">●</Label> подключён</span>
            <span><Label theme="info" size="xs">●</Label> отключён</span>
            <span><Label theme="danger" size="xs">●</Label> заблокирован</span>
          </div>
        </Card>
      )}
    </>
  );
}
