import React from 'react';
import { useAuth } from '../../auth/useAuth';

export function AppHeader() {
  const { me, logout } = useAuth();

  return (
    <header style={{
      borderBottom: '1px solid var(--gray-200)',
      background: 'white',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)'
    }}>
      <div className="container row" style={{ padding: '12px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '700',
            fontSize: '14px'
          }}>NT</div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--gray-900)' }}>NT Woods</div>
            <div style={{ fontSize: '11px', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>HRMS Portal</div>
          </div>
        </div>
        <div className="spacer" />
        {me ? (
          <div className="row" style={{ gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--gray-800)' }}>{me.fullName ?? me.email}</div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                <span className="badge blue" style={{ marginRight: '0' }}>{me.role}</span>
              </div>
            </div>
            <button className="button sm" onClick={logout} style={{ color: 'var(--danger)' }}>Logout</button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
