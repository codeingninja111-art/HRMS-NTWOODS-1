import { API_BASE_URL } from '../config';

export class ApiError extends Error {
  constructor(code, message, status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function urlJoin_(base, path) {
  const b = String(base || '').replace(/\/$/, '');
  const p = String(path || '');
  if (!b) return p;
  if (!p) return b;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${b}${p.startsWith('/') ? '' : '/'}${p}`;
}

async function parseJsonSafe_(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function errorFromResponse_(res, payload) {
  const status = res?.status ?? 0;
  const code = payload?.error?.code || (status ? `HTTP_${status}` : 'BAD_RESPONSE');
  const message = payload?.error?.message || res?.statusText || 'Request failed';
  const details = payload?.error?.details ?? null;
  return new ApiError(code, message, status, details);
}

export async function apiRequest(
  path,
  { method = 'GET', token = null, query = null, body = null, responseType = 'json' } = {}
) {
  if (!API_BASE_URL) {
    throw new ApiError('CONFIG_MISSING', 'Missing VITE_API_BASE_URL (or VITE_API_ENDPOINT)');
  }

  const u = new URL(urlJoin_(API_BASE_URL, path));
  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query)) {
      if (v === null || v === undefined || v === '') continue;
      u.searchParams.set(k, String(v));
    }
  }

  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let bodyRaw = null;
  if (body !== null && body !== undefined) {
    headers.set('Content-Type', 'application/json');
    bodyRaw = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(u.toString(), { method, headers, body: bodyRaw });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Network error calling backend');
  }

  if (responseType === 'blob') {
    if (!res.ok) {
      const payload = await parseJsonSafe_(res);
      throw errorFromResponse_(res, payload);
    }
    return await res.blob();
  }

  const payload = await parseJsonSafe_(res);
  if (!payload || typeof payload.success !== 'boolean') {
    if (!res.ok) throw new ApiError(`HTTP_${res.status}`, res.statusText || 'Request failed', res.status);
    return payload;
  }

  if (!payload.success) {
    throw errorFromResponse_(res, payload);
  }

  return payload.data;
}

export function apiGet(path, opts) {
  return apiRequest(path, { ...opts, method: 'GET' });
}

export function apiPost(path, body, opts) {
  return apiRequest(path, { ...opts, method: 'POST', body });
}

