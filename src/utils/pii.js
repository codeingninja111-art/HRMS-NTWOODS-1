export function looksLikeSha256Hex(value) {
  const s = String(value || '').trim();
  return /^[0-9a-f]{64}$/i.test(s);
}

function looksLikeEncValue_(value) {
  const s = String(value || '').trim();
  return s.startsWith('v1:') || s.startsWith('v0:');
}

// UI helper: hide raw hashes from rendering.
export function safeActorLabel(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (looksLikeSha256Hex(s)) return '';
  if (looksLikeEncValue_(s)) return '';
  return s;
}

function normalizeSpaces_(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function safeCandidateNameLabel(value) {
  const s = normalizeSpaces_(value);
  if (!s) return '';
  if (looksLikeSha256Hex(s)) return '';
  if (looksLikeEncValue_(s)) return '';
  if (s.includes('*')) return '';
  return s;
}

export function safePhoneLabel(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (looksLikeSha256Hex(s)) return '';
  if (looksLikeEncValue_(s)) return '';

  // Never render masked numbers.
  if (/[x*]/i.test(s)) return '';

  const digits = s.replace(/\D+/g, '');
  if (!digits) return '';

  let d = digits;
  if (d.startsWith('91') && d.length === 12) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  if (d.length < 4) return '';

  return d;
}

function safePhoneFull_(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (looksLikeSha256Hex(s)) return '';
  if (looksLikeEncValue_(s)) return '';
  if (/[x*]/i.test(s)) return '';

  const digits = s.replace(/\D+/g, '');
  if (!digits) return '';

  let d = digits;
  if (d.startsWith('91') && d.length === 12) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  if (d.length < 4) return '';
  return d;
}

export function candidateDisplayName(it) {
  const full = normalizeSpaces_(it?.candidateNameFull);
  if (full && !looksLikeSha256Hex(full) && !looksLikeEncValue_(full) && !full.includes('*')) return full;

  // Legacy fallback (some older APIs might still return plaintext).
  const legacy = normalizeSpaces_(it?.candidateName);
  if (legacy && !looksLikeSha256Hex(legacy) && !looksLikeEncValue_(legacy) && !legacy.includes('*')) return legacy;

  return '';
}

export function candidateDisplayMobile(it) {
  const full = safePhoneFull_(it?.mobileFull);
  if (full) return full;

  const legacy = safePhoneFull_(it?.mobile);
  if (legacy) return legacy;

  return '';
}
