import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { Card, TextInput, Label, Button, Alert } from '@gravity-ui/uikit';
import {
  getMe,
  setupTotp,
  enableTotp,
  disableTotp,
  revokeAllSessions,
  getProxyTemplates,
  deleteProxyTemplate,
  getBackupStatus,
  logout,
  type ProxyTemplateRow,
} from '../../api';
import { useThemeMode } from '../../ThemeModeProvider';
import s from './Settings.module.scss';

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeMode();
  const [username, setUsername] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpErr, setTotpErr] = useState('');
  const [templates, setTemplates] = useState<ProxyTemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [revokePassword, setRevokePassword] = useState('');
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [backupInfo, setBackupInfo] = useState<{ configured: boolean; lastBackupAt: string | null; unreadable?: boolean } | null>(null);

  const refresh = () => {
    getMe()
      .then((data) => {
        setUsername(data.user.username);
        setTotpEnabled(data.totpEnabled === true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    getProxyTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
    getBackupStatus()
      .then(setBackupInfo)
      .catch(() => setBackupInfo(null));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleStartTotp = async () => {
    setTotpErr('');
    setTotpBusy(true);
    try {
      const data = await setupTotp();
      setTotpSetup(data);
      setTotpCode('');
    } catch (e: any) {
      setTotpErr(e.message || 'Ошибка');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleEnableTotp = async (e: FormEvent) => {
    e.preventDefault();
    setTotpErr('');
    setTotpBusy(true);
    try {
      await enableTotp(totpCode.trim());
      setTotpSetup(null);
      setTotpCode('');
      setTotpEnabled(true);
    } catch (e: any) {
      setTotpErr(e.message || 'Неверный код');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleDisableTotp = async (e: FormEvent) => {
    e.preventDefault();
    setTotpErr('');
    setTotpBusy(true);
    try {
      await disableTotp(disablePassword);
      setDisablePassword('');
      setTotpEnabled(false);
      setTotpSetup(null);
    } catch (e: any) {
      setTotpErr(e.message || 'Ошибка');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleRevokeSessions = async (e: FormEvent) => {
    e.preventDefault();
    setTotpErr('');
    setRevokeBusy(true);
    try {
      await revokeAllSessions(revokePassword);
      setRevokePassword('');
      logout();
    } catch (e: any) {
      setTotpErr(e.message || 'Ошибка');
    } finally {
      setRevokeBusy(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm('Удалить шаблон?')) return;
    try {
      await deleteProxyTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setTotpErr(e.message || 'Не удалось удалить');
    }
  };

  return (
    <>
      <h2 className={s.title}>Настройки</h2>

      {totpErr && (
        <div className={s.alertWrap}>
          <Alert theme="danger" message={totpErr} onClose={() => setTotpErr('')} />
        </div>
      )}

      <Card view="outlined" className={s.card}>
        <h3>Документация</h3>
        <p className={s.securityText}>Краткий список переменных окружения панели и ноды.</p>
        <Button view="outlined" onClick={() => navigate('/docs')}>
          Открыть справку
        </Button>
      </Card>

      <Card view="outlined" className={s.card}>
        <h3>Внешний вид</h3>
        <p className={s.securityText}>Тема интерфейса сохраняется в этом браузере.</p>
        <div className={s.themeRow}>
          <Button view={theme === 'light' ? 'action' : 'outlined'} size="l" onClick={() => setTheme('light')}>
            Светлая
          </Button>
          <Button view={theme === 'dark' ? 'action' : 'outlined'} size="l" onClick={() => setTheme('dark')}>
            Тёмная
          </Button>
        </div>
      </Card>

      <Card view="outlined" className={s.card}>
        <h3>Аккаунт</h3>
        <div className={s.field}>
          <label>Имя пользователя</label>
          <TextInput value={username} size="l" disabled={loading} />
        </div>
        <div className={s.hint}>
          <Label theme="info" size="xs">
            Для смены пароля обновите переменную ADMIN_PASSWORD и перезапустите бэкенд.
          </Label>
        </div>
        <form onSubmit={handleRevokeSessions} className={s.totpForm}>
          <h4 className={s.subCardTitle}>Сессии</h4>
          <p className={s.securityText}>
            «Выйти везде»: аннулирует все выданные JWT (другие браузеры и устройства). Потребуется войти снова.
          </p>
          <div className={s.field}>
            <label>Текущий пароль</label>
            <TextInput
              type="password"
              value={revokePassword}
              onUpdate={setRevokePassword}
              size="l"
              placeholder="Пароль"
            />
          </div>
          <Button type="submit" view="outlined" loading={revokeBusy} disabled={!revokePassword}>
            Выйти везде
          </Button>
        </form>
      </Card>

      <Card view="outlined" className={s.card}>
        <h3>Двухфакторная аутентификация (TOTP)</h3>
        {totpEnabled ? (
          <form onSubmit={handleDisableTotp} className={s.totpForm}>
            <p className={s.securityText}>2FA включена. Для входа нужен код из приложения-аутентификатора.</p>
            <div className={s.field}>
              <label>Текущий пароль панели</label>
              <TextInput
                type="password"
                value={disablePassword}
                onUpdate={setDisablePassword}
                size="l"
                placeholder="Пароль"
              />
            </div>
            <Button type="submit" view="outlined" loading={totpBusy} disabled={!disablePassword}>
              Отключить 2FA
            </Button>
          </form>
        ) : (
          <div>
            {!totpSetup ? (
              <div>
                <p className={s.securityText}>
                  Добавьте одноразовые коды (Google Authenticator, Aegis и т.п.). После настройки вход потребует код
                  вместе с паролем.
                </p>
                <Button view="action" loading={totpBusy} onClick={handleStartTotp}>
                  Начать настройку 2FA
                </Button>
              </div>
            ) : (
              <form onSubmit={handleEnableTotp} className={s.totpForm}>
                <p className={s.securityText}>
                  Секрет (если приложение не сканирует QR — введите вручную): <code>{totpSetup.secret}</code>
                </p>
                <div className={s.qrWrap}>
                  <QRCode value={totpSetup.otpauthUri} size={180} />
                </div>
                <div className={s.field}>
                  <label>URI для приложения (otpauth)</label>
                  <TextInput value={totpSetup.otpauthUri} onUpdate={() => {}} size="l" controlProps={{ readOnly: true }} />
                </div>
                <div className={s.field}>
                  <label>Код из приложения</label>
                  <TextInput value={totpCode} onUpdate={setTotpCode} size="l" placeholder="000000" />
                </div>
                <div className={s.themeRow}>
                  <Button type="submit" view="action" loading={totpBusy} disabled={totpCode.trim().length < 6}>
                    Включить 2FA
                  </Button>
                  <Button type="button" view="outlined" onClick={() => setTotpSetup(null)} disabled={totpBusy}>
                    Отмена
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Card>

      <Card view="outlined" className={s.card}>
        <h3>Шаблоны прокси</h3>
        <p className={s.securityText}>
          Сохранённые пресеты для формы «Добавить прокси». Удаление здесь не затрагивает уже созданные прокси.
        </p>
        {templatesLoading ? (
          <p className={s.securityText}>Загрузка…</p>
        ) : templates.length === 0 ? (
          <p className={s.securityText}>Шаблонов пока нет — создайте при добавлении прокси.</p>
        ) : (
          <ul className={s.templateList}>
            {templates.map((t) => (
              <li key={t.id} className={s.templateItem}>
                <span>{t.name}</span>
                <Button size="s" view="outlined" onClick={() => handleDeleteTemplate(t.id)}>
                  Удалить
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card view="outlined" className={s.card}>
        <h3>Резервное копирование БД панели</h3>
        <p className={s.securityText}>
          Панель хранит данные в PostgreSQL (см. переменную <code>DATABASE_URL</code> в окружении бэкенда). Рекомендуется
          периодически выгружать дамп на отдельный носитель.
        </p>
        <p className={s.securityText}>
          На сервере с БД выполните (подставьте пользователя и имя базы из <code>DATABASE_URL</code>):
        </p>
        <pre className={s.codeBlock}>
          {`pg_dump "$DATABASE_URL" -Fc -f mtproto-panel-$(date +%Y%m%d).dump`}
        </pre>
        <p className={s.securityText}>Восстановление в пустую базу:</p>
        <pre className={s.codeBlock}>
          {`pg_restore -d "$DATABASE_URL" --clean --if-exists mtproto-panel-YYYYMMDD.dump`}
        </pre>
        <p className={s.securityText}>
          Автоматический cron может писать метку в файл (см. <code>BACKUP_STATUS_FILE</code> на бэкенде), например:
        </p>
        <pre className={s.codeBlock}>
          {`echo '{"lastBackupAt":"'$(date -Iseconds)'"}' > /var/lib/mtproto-panel/backup-status.json`}
        </pre>
        {backupInfo && (
          <p className={s.securityText}>
            {backupInfo.configured ? (
              <>
                Последний бэкап (по файлу на сервере):{' '}
                {backupInfo.lastBackupAt
                  ? new Date(backupInfo.lastBackupAt).toLocaleString('ru-RU')
                  : backupInfo.unreadable
                    ? 'файл недоступен'
                    : 'метки ещё нет'}
              </>
            ) : (
              <>Файл статуса бэкапа не настроен (<code>BACKUP_STATUS_FILE</code> пуст).</>
            )}
          </p>
        )}
        <div className={s.hint}>
          <Label theme="warning" size="xs">
            Перед восстановлением остановите бэкенд панели, чтобы не было одновременных записей.
          </Label>
        </div>
      </Card>

      <Card view="outlined" className={s.card}>
        <h3>Безопасность API панели</h3>
        <div className={s.field}>
          <label>Ограничение по IP</label>
          <p className={s.securityText}>
            Переменная окружения <code>PANEL_ALLOWED_IPS</code> — список IP через запятую (точное совпадение).
            Пусто — доступ с любого IP. Эндпоинты <code>/api/health</code> и <code>/api/ready</code> не ограничиваются.
          </p>
        </div>
        <div className={s.field}>
          <label>За reverse proxy</label>
          <p className={s.securityText}>
            Установите <code>TRUST_PROXY=1</code>, чтобы учитывать заголовок <code>X-Forwarded-For</code> при проверке IP.
          </p>
        </div>
        <div className={s.field}>
          <label>Вход и секреты</label>
          <p className={s.securityText}>
            Лимит попыток логина: <code>LOGIN_RATE_LIMIT_WINDOW_MS</code> (окно, мс) и <code>LOGIN_RATE_LIMIT_MAX</code>{' '}
            (число запросов).
            В режиме production сильный <code>JWT_SECRET</code> обязателен (≥32 символа, не дефолт); вне production можно
            задать <code>REQUIRE_STRONG_SECRETS=1</code>.
          </p>
        </div>
      </Card>
    </>
  );
}
