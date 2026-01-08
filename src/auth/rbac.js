function normalizeRole_(role) {
  const r = String(role || '').trim().toUpperCase();
  return r || null;
}

export function getEffectiveRole(auth) {
  const direct = normalizeRole_(auth?.me?.role);
  if (direct) return direct;
  const legacy = normalizeRole_(auth?.legacyRole);
  if (legacy) return legacy;
  const r = normalizeRole_(auth?.role);
  return r;
}

export function isAdmin(authOrRole) {
  if (typeof authOrRole === 'string') return normalizeRole_(authOrRole) === 'ADMIN';
  return getEffectiveRole(authOrRole) === 'ADMIN';
}

export function roleAllowed(role, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  const r = normalizeRole_(role);
  if (!r) return false;
  return allowedRoles.map(normalizeRole_).includes(r);
}

export function allowPortal(auth, portalKey, fallbackRoles = []) {
  if (isAdmin(auth)) return true;
  const role = getEffectiveRole(auth);
  const fallbackAllowed = roleAllowed(role, fallbackRoles);
  if (!portalKey) return fallbackAllowed;

  const v = typeof auth?.canPortal === 'function' ? auth.canPortal(portalKey) : null;
  if (v === true || v === false) return v;
  return fallbackAllowed;
}

export function allowAction(auth, actionKey, fallbackRoles = []) {
  if (isAdmin(auth)) return true;
  const role = getEffectiveRole(auth);
  const fallbackAllowed = roleAllowed(role, fallbackRoles);
  if (!actionKey) return fallbackAllowed;

  const v = typeof auth?.canAction === 'function' ? auth.canAction(actionKey) : null;
  if (v === true || v === false) return v;
  return fallbackAllowed;
}

export function allowUi(auth, uiKey, fallbackRoles = []) {
  if (isAdmin(auth)) return true;
  const role = getEffectiveRole(auth);
  const fallbackAllowed = roleAllowed(role, fallbackRoles);
  if (!uiKey) return fallbackAllowed;

  const v = typeof auth?.canUi === 'function' ? auth.canUi(uiKey) : null;
  if (v === true || v === false) return v;
  return fallbackAllowed;
}

// Convenience: can(role, actionKey) – uses server permission keys when available.
export function can(auth, actionKey, fallbackRoles = []) {
  return allowAction(auth, actionKey, fallbackRoles);
}

