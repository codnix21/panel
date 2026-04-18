import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';

export function useLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password, needsTotp ? totp : undefined);
      navigate('/nodes');
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      if (msg === 'totp_required') {
        setNeedsTotp(true);
        setError('Введите код из приложения-аутентификатора');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    username,
    setUsername,
    password,
    setPassword,
    totp,
    setTotp,
    needsTotp,
    error,
    loading,
    handleSubmit,
  };
}
