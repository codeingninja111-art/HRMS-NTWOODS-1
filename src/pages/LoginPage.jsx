import React, { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const { loginWithPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = useCallback(async () => {
    const e = String(email || '').trim();
    const p = String(password || '');
    if (!e || !p) {
      toast.error('Enter email and password');
      return;
    }

    setLoading(true);
    try {
      await loginWithPassword(e, p);
      navigate('/reports', { replace: true });
    } catch (err) {
      toast.error(err?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }, [email, password, loginWithPassword, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '800',
            fontSize: '24px',
            margin: '0 auto 24px',
            boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
          }}
        >
          NT
        </div>

        <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: '700', color: 'var(--gray-900)' }}>
          Welcome Back
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--gray-500)', fontSize: '15px' }}>
          Sign in to NT Woods HRMS Portal
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onLogin();
            }}
          />
          <button className="button primary" type="button" onClick={onLogin} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        <p style={{ marginTop: '20px', fontSize: '12px', color: 'var(--gray-400)' }}>
          Access denied? Contact your Administrator
        </p>
      </div>
    </div>
  );
}

