const DEFAULT_START = { h: 9, m: 30 };
const DEFAULT_END = { h: 18, m: 30 };

function minutes_(t) {
  return t.h * 60 + t.m;
}

function parseTime_(value) {
  const raw = String(value || '').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
  if (h < 0 || h > 23) return null;
  if (mi < 0 || mi > 59) return null;
  return { h, m: mi };
}

// Safer than new Date("YYYY-MM-DDTHH:mm") across browsers (explicit local time).
export function parseDateTimeLocal(value) {
  const raw = String(value || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!m) return null;

  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const hh = Number(m[4]);
  const mi = Number(m[5]);

  const dt = new Date(yyyy, mm - 1, dd, hh, mi, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function isSunday(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) && date.getDay() === 0;
}

export function validateScheduleDateTimeLocal(value, { allowSunday = false, workStart = '09:30', workEnd = '18:30' } = {}) {
  const dt = parseDateTimeLocal(value);
  if (!dt) return { ok: false, code: 'INVALID', message: 'Invalid date/time' };

  if (!allowSunday && isSunday(dt)) {
    return { ok: false, code: 'SUNDAY', message: 'Sunday scheduling is not allowed' };
  }

  const start = parseTime_(workStart) ?? DEFAULT_START;
  const end = parseTime_(workEnd) ?? DEFAULT_END;

  const mins = dt.getHours() * 60 + dt.getMinutes();
  if (mins < minutes_(start) || mins > minutes_(end)) {
    return {
      ok: false,
      code: 'WORKING_HOURS',
      message: `Allowed time: ${workStart}–${workEnd}`,
    };
  }

  return { ok: true, date: dt };
}

