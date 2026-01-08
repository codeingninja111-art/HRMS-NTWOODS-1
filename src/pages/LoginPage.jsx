import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { GoogleOAuthButton } from '../auth/GoogleOAuthButton';
import { useAuth } from '../auth/useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const { loginWithGoogleIdToken, loginWithEmployeeId } = useAuth();

  const [employeeId, setEmployeeId] = useState('');
  const [empLoading, setEmpLoading] = useState(false);

  const onCredential = useCallback(
    async (idToken) => {
      try {
        await loginWithGoogleIdToken(idToken);
        navigate('/dashboard', { replace: true });
      } catch (e) {
        toast.error(e?.message ?? 'Login failed');
      }
    },
    [loginWithGoogleIdToken, navigate]
  );

  const onEmployeeLogin = useCallback(
    async () => {
      const id = String(employeeId || '').trim();
      if (!id) {
        toast.error('Enter Employee ID');
        return;
      }
      setEmpLoading(true);
      try {
        await loginWithEmployeeId(id);
        navigate('/employee/trainings', { replace: true });
      } catch (e) {
        toast.error(e?.message ?? 'Login failed');
      } finally {
        setEmpLoading(false);
      }
    },
    [employeeId, loginWithEmployeeId, navigate]
  );

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{
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
          boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)'
        }}>NT</div>

        <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: '700', color: 'var(--gray-900)' }}>
          Welcome Back
        </h1>
        <p style={{ margin: '0 0 32px', color: 'var(--gray-500)', fontSize: '15px' }}>
          Sign in to NT Woods HRMS Portal
        </p>

        <GoogleOAuthButton onCredential={onCredential} />

        <div style={{
          marginTop: '24px',
          padding: '12px 16px',
          background: 'var(--gray-50)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          color: 'var(--gray-600)'
        }}>
          Use your NT Woods authorized Google account
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="small" style={{ marginBottom: 8, color: 'var(--gray-600)' }}>
            Employee login (no password)
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              placeholder="Employee ID"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              autoComplete="off"
            />
            <button className="button primary" type="button" onClick={onEmployeeLogin} disabled={empLoading}>
              {empLoading ? 'Signing in…' : 'Login with Employee ID'}
            </button>
          </div>
        </div>

        <p style={{
          marginTop: '20px',
          fontSize: '12px',
          color: 'var(--gray-400)'
        }}>
          Access denied? Contact your Administrator
        </p>
      </div>
    </div>
  );
}
