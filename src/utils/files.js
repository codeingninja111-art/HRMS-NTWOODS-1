import { API_ENDPOINT } from '../config';

function backendBaseFromApiEndpoint_() {
  const endpoint = String(API_ENDPOINT || '').trim();
  if (!endpoint) return '';

  try {
    const u = new URL(endpoint);
    // Keep any path prefix (e.g. /hrms) but strip trailing /api.
    u.pathname = u.pathname.replace(/\/api\/?$/i, '/');
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function isHex32_(value) {
  return /^[0-9a-f]{32}$/i.test(String(value || '').trim());
}

function isHttpUrl_(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function isGoogleHostPath_(value) {
  return /^(drive|docs)\.google\.com\//i.test(String(value || '').trim());
}

export function openFile(fileId, token) {
  const id = String(fileId || '').trim();
  if (!id) return false;

  // If already a URL, open as-is.
  if (isHttpUrl_(id)) {
    window.open(id, '_blank', 'noopener,noreferrer');
    return true;
  }

  // Common copy/paste: "drive.google.com/..." or "docs.google.com/..."
  if (isGoogleHostPath_(id)) {
    window.open(`https://${id}`, '_blank', 'noopener,noreferrer');
    return true;
  }

  const base = backendBaseFromApiEndpoint_();
  const isLocalId = isHex32_(id);

  // Flask backend local uploads.
  if (isLocalId && base) {
    const t = String(token || '').trim();
    if (!t) return false;
    const url = `${base}/files/${encodeURIComponent(id)}?token=${encodeURIComponent(t)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  // Legacy Apps Script / Drive uploads.
  const url = `https://drive.google.com/open?id=${encodeURIComponent(id)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
