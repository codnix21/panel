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
    </>
  );
}
