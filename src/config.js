function normalizeBaseUrl_(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    // Support legacy configs pointing at ".../api" by normalizing to backend base.
    u.pathname = u.pathname.replace(/\/api\/?$/i, '/');
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return s.replace(/\/$/, '');
  }
}

// Prefer VITE_API_BASE_URL; fall back to legacy VITE_API_ENDPOINT.
export const API_BASE_URL = normalizeBaseUrl_(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_ENDPOINT);

// Legacy export (older action-dispatcher client uses this as the POST URL).
export const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

// Legacy export (Google login flow - not used in the new JWT login).
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
