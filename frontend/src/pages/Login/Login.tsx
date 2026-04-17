import { Button, TextInput, Card, Alert } from '@gravity-ui/uikit';
import { useLogin } from '../../hooks/useLogin';
import s from './Login.module.scss';

export default function Login() {
  const { username, setUsername, password, setPassword, error, loading, handleSubmit } = useLogin();

  return (
    <div className={s.container}>
      <Card className={s.card} view="outlined">
        <h2>MTProto Panel</h2>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className={s.errorWrap}>
              <Alert theme="danger" message={error} />
            </div>
          )}
          <div className={s.field}>
            <label>Имя пользователя</label>
            <TextInput
              value={username}
              onUpdate={setUsername}
              placeholder="Введите имя"
              size="l"
              autoFocus
            />
          </div>
          <div className={s.field}>
            <label>Пароль</label>
            <TextInput
              value={password}
              onUpdate={setPassword}
              type="password"
              placeholder="Введите пароль"
              size="l"
            />
          </div>
          <Button
            type="submit"
            view="action"
            size="l"
            width="max"
            loading={loading}
          >
            Войти
          </Button>
        </form>
      </Card>
    </div>
  );
}
