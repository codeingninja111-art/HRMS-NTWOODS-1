const TOKEN_KEY = 'ntw_hrms_session_token';
const REJECT_REVERT_DRAFT_KEY = 'ntw_hrms_reject_revert_draft_v1';
const ME_CACHE_KEY = 'ntw_hrms_me_cache_v1';
const PERMISSIONS_CACHE_KEY = 'ntw_hrms_permissions_cache_v1';

export function loadSessionToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveSessionToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearSessionToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function loadMeCache() {
  try {
    const raw = window.localStorage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveMeCache(me) {
  try {
    if (!me || typeof me !== 'object') return;
    window.localStorage.setItem(ME_CACHE_KEY, JSON.stringify(me));
  } catch {
    // ignore
  }
}

export function clearMeCache() {
  try {
    window.localStorage.removeItem(ME_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function loadPermissionsCache() {
  try {
    const raw = window.localStorage.getItem(PERMISSIONS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePermissionsCache(permissions) {
  try {
    if (!permissions || typeof permissions !== 'object') return;
    window.localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(permissions));
  } catch {
    // ignore
  }
}

export function clearPermissionsCache() {
  try {
    window.localStorage.removeItem(PERMISSIONS_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function loadRejectRevertDraft() {
  try {
    const raw = window.localStorage.getItem(REJECT_REVERT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      requirementId: String(parsed.requirementId || ''),
      candidateId: String(parsed.candidateId || ''),
      remark: String(parsed.remark || ''),
      savedAt: parsed.savedAt ? String(parsed.savedAt) : undefined,
    };
  } catch {
    return null;
  }
}

export function saveRejectRevertDraft({ requirementId, candidateId, remark } = {}) {
  try {
    const payload = {
      requirementId: String(requirementId || '').trim(),
      candidateId: String(candidateId || '').trim(),
      remark: String(remark || '').trim(),
      savedAt: new Date().toISOString(),
    };
    if (!payload.requirementId || !payload.candidateId) return;
    window.localStorage.setItem(REJECT_REVERT_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function clearRejectRevertDraft() {
  try {
    window.localStorage.removeItem(REJECT_REVERT_DRAFT_KEY);
  } catch {
    // ignore
  }
}
