import { useState, useEffect } from 'react';
import { Card, TextInput, Label } from '@gravity-ui/uikit';
import { getMe } from '../../api';
import s from './Settings.module.scss';

export default function Settings() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((data) => setUsername(data.user.username))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <h2 className={s.title}>Настройки</h2>

      <Card view="outlined" className={s.card}>
        <h3>Аккаунт</h3>
        <div className={s.field}>
          <label>Имя пользователя</label>
          <TextInput value={username} size="l" disabled />
        </div>
        <div className={s.hint}>
          <Label theme="info" size="xs">
            Для смены пароля обновите переменную ADMIN_PASSWORD и перезапустите бэкенд.
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
            Лимит попыток логина: <code>LOGIN_RATE_LIMIT_WINDOW_MS</code> (окно, мс) и <code>LOGIN_RATE_LIMIT_MAX</code> (число запросов).
            В режиме production сильный <code>JWT_SECRET</code> обязателен (≥32 символа, не дефолт); вне production можно задать{' '}
            <code>REQUIRE_STRONG_SECRETS=1</code>.
          </p>
        </div>
      </Card>
    </>
  );
}
