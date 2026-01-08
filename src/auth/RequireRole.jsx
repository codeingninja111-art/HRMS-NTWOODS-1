import React from 'react';
import { useAuth } from './useAuth';
import { allowAction, allowPortal, allowUi, getEffectiveRole, roleAllowed } from './rbac';

export function RequireRole({
  allowedRoles,
  portalKey,
  actionKey,
  uiKey,
  fallback = null,
  children,
}) {
  const auth = useAuth();
  const role = getEffectiveRole(auth);
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [];

  const ok =
    (portalKey ? allowPortal(auth, portalKey, roles) : true) &&
    (actionKey ? allowAction(auth, actionKey, roles) : true) &&
    (uiKey ? allowUi(auth, uiKey, roles) : true) &&
    (roles.length ? roleAllowed(role, roles) || role === 'ADMIN' : true);

  if (ok) return children;
  return fallback;
}

