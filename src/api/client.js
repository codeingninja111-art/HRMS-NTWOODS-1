import { API_ENDPOINT } from '../config';

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

const inflight_ = new Map();

function normalizeRbacMessage_(code, message) {
  if (code !== 'RBAC_DENIED') return message;
  const m = String(message || '');
  const match = /Not allowed for role:\s*([A-Za-z_\-]+)/i.exec(m);
  if (!match) return m;
  const role = String(match[1] || '').toUpperCase();
  // Helpful hint: usually caused by backend role stored as lowercase.
  return `Not allowed for role: ${role}. If this is ADMIN, redeploy the Apps Script backend or fix Users/Sessions role casing.`;
}

function inflightKey_(action, token, data) {
  try {
    const a = String(action || '').toUpperCase().trim();
    const t = String(token || '');
    const d = data ?? {};
    return `${a}|${t}|${JSON.stringify(d)}`;
  } catch {
    return null;
  }
}

async function apiPostImpl_(action, data, token, { signal } = {}) {
  if (!API_ENDPOINT) {
    throw new ApiError('CONFIG_MISSING', 'Missing VITE_API_ENDPOINT');
  }

  const payload = {
    action,
    token: token ?? null,
    data: data ?? {},
  };

  let res;
  try {
    res = await fetch(API_ENDPOINT, {
      method: 'POST',
      // IMPORTANT: text/plain avoids CORS preflight for JSON payloads.
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Network error calling backend');
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new ApiError('BAD_RESPONSE', 'Backend returned non-JSON response');
  }

  if (!json || typeof json.ok !== 'boolean') {
    throw new ApiError('BAD_RESPONSE', 'Backend response missing ok flag');
  }

  if (!json.ok) {
    const code = json?.error?.code ?? 'UNKNOWN_ERROR';
    const message0 = normalizeRbacMessage_(code, json?.error?.message ?? 'Unknown backend error');
    const actionTag = String(action || '').toUpperCase().trim();
    const message = actionTag ? `${message0} (action: ${actionTag})` : message0;
    throw new ApiError(code, message);
  }

  return json.data;
}

export async function apiPost(action, data, token, { signal } = {}) {
  // Coalesce identical in-flight requests (prevents duplicate calls from StrictMode double-effects and fast navigation).
  // If a signal is provided, skip coalescing to avoid aborting shared requests.
  if (signal) {
    return apiPostImpl_(action, data, token, { signal });
  }

  const key = inflightKey_(action, token, data);
  if (key && inflight_.has(key)) return inflight_.get(key);

  const p = apiPostImpl_(action, data, token, { signal: null });
  if (key) inflight_.set(key, p);
  try {
    return await p;
  } finally {
    if (key) inflight_.delete(key);
  }
}
