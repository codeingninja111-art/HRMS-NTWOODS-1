import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export function ProtectedRoute({ allowedRoles, portalKey, children }) {
  const { status, isAuthenticated, role, canPortal } = useAuth();

  if (status === 'loading') {
    return (
      <div className="container">
        <div className="card">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const needsRole = Boolean(portalKey) || (Array.isArray(allowedRoles) && allowedRoles.length > 0);
  if (needsRole && !role) {
    return (
      <div className="container">
        <div className="card">Loading…</div>
      </div>
    );
  }

  // Admin is allowed everywhere in-app.
  if (role === 'ADMIN') {
    return children;
  }

  // Prefer dynamic portal permissions when available.
  if (portalKey) {
    const allowed = canPortal ? canPortal(portalKey) : null;
    if (allowed === false) {
      return (
        <div className="container">
          <div className="card">Access denied.</div>
        </div>
      );
    }
    if (allowed === true) {
      return children;
    }
    // allowed === null => permissions not loaded; fall back to allowedRoles below.
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <div className="container">
        <div className="card">Access denied.</div>
      </div>
    );
  }

  return children;
}
