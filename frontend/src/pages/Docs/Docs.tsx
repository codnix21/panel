import { Card, Button } from '@gravity-ui/uikit';
import { useNavigate } from 'react-router-dom';
import s from './Docs.module.scss';

export default function Docs() {
  const navigate = useNavigate();
  return (
    <>
      <div className={s.top}>
        <Button view="flat" onClick={() => navigate('/settings')}>← Настройки</Button>
        <h2 className={s.title}>Справка по переменным</h2>
      </div>

      <Card view="outlined" className={s.card}>
        <h3>Панель (backend)</h3>
        <ul className={s.list}>
          <li><code>PORT</code> — порт HTTP API (по умолчанию 3000).</li>
          <li><code>JWT_SECRET</code> — секрет подписи JWT; в production не короче 32 символов.</li>
          <li><code>DB_HOST</code>, <code>DB_PORT</code>, <code>DB_NAME</code>, <code>DB_USER</code>, <code>DB_PASSWORD</code> — PostgreSQL.</li>
          <li><code>PANEL_ALLOWED_IPS</code> — список IP через запятую; пусто = все.</li>
          <li><code>TRUST_PROXY=1</code> — доверять <code>X-Forwarded-For</code> за reverse proxy.</li>
          <li><code>HEALTH_POLL_INTERVAL_MS</code> — интервал опроса нод (мс), по умолчанию 60000.</li>
          <li><code>HEALTH_STALE_AFTER_MS</code> — после какой задержки last_seen считается «давно» (мс), по умолчанию 120000.</li>
          <li><code>NOTIFY_WEBHOOK_URL</code> — POST JSON при падении ноды и частичных ошибках массовых операций.</li>
          <li><code>TELEGRAM_BOT_TOKEN</code>, <code>TELEGRAM_CHAT_ID</code> — альтернатива/дополнение к webhook.</li>
          <li><code>EXPECTED_PROXY_IMAGE_REF</code>, <code>EXPECTED_NGINX_IMAGE_REF</code> — подстрока в имени/id образа; для баннера «обновление» на сводке.</li>
          <li><code>BACKUP_STATUS_FILE</code> — путь к JSON <code>{`{ "lastBackupAt": "ISO-8601" }`}</code>, который пишет внешний cron.</li>
        </ul>
      </Card>

      <Card view="outlined" className={s.card}>
        <h3>Сервис-нода</h3>
        <ul className={s.list}>
          <li><code>AUTH_TOKEN</code> / токен в панели — доступ к API ноды.</li>
          <li>Порт API (часто 8443) и <code>NGINX_PORT</code> (часто 443) — в <code>.env</code> на сервере ноды.</li>
          <li>После смены токена в панели обновите <code>AUTH_TOKEN</code> на ноде и перезапустите контейнеры.</li>
        </ul>
        <p className={s.note}>Полная документация по развёртыванию ноды — в README репозитория сервис-ноды.</p>
      </Card>
    </>
  );
}
