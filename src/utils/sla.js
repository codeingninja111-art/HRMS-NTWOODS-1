const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

export function normalizeStepKey(stepKey) {
  return String(stepKey || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

export function toMs(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return null;
  return ms;
}

export function formatDurationMs(ms) {
  if (!Number.isFinite(ms)) return '-';
  const abs = Math.abs(ms);
  const totalSeconds = Math.floor(abs / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  // Keep days only when it matters to avoid huge HH values.
  return days ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

export function formatDueAt(value, { timeZone = DEFAULT_TIME_ZONE } = {}) {
  const ms = toMs(value);
  if (ms == null) return '';
  const d = new Date(ms);
  try {
    const fmt = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    // en-IN commonly gives "dd/mm/yyyy, hh:mm"
    return fmt.format(d).replace(',', '').replace(/\//g, '-');
  } catch {
    return d.toLocaleString();
  }
}

export function deriveSlaCountdown({
  sla,
  stepKey,
  stepStartAt,
  plannedMinutes,
  deadlineAt,
  nowMs,
  timeZone = DEFAULT_TIME_ZONE,
  dueSoonMs = 10 * 60 * 1000,
} = {}) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();

  const stepName = normalizeStepKey(sla?.stepName || stepKey || '');
  const planned = Number(sla?.plannedMinutes ?? plannedMinutes ?? 0) || 0;

  const startRaw = sla?.startAt || stepStartAt || '';
  const startMs = toMs(startRaw);

  const deadlineRaw = sla?.deadlineAt || deadlineAt || '';
  const deadlineMsFromApi = toMs(deadlineRaw);

  const deadlineMs =
    deadlineMsFromApi != null
      ? deadlineMsFromApi
      : planned > 0 && startMs != null
        ? startMs + planned * 60 * 1000
        : null;

  const hasConfig = planned > 0;
  const hasDeadline = deadlineMs != null;

  if (!hasConfig) {
    return {
      stepName,
      plannedMinutes: planned,
      hasSla: false,
      reason: 'NO_SLA_CONFIG',
      deadlineAt: '',
      remainingMs: null,
      isOverdue: false,
      status: null,
      badgeVariant: 'gray',
      badgeText: 'No SLA',
      deadlineText: '',
      plannedText: '',
    };
  }

  if (!hasDeadline) {
    return {
      stepName,
      plannedMinutes: planned,
      hasSla: false,
      reason: 'MISSING_START_TIME',
      deadlineAt: '',
      remainingMs: null,
      isOverdue: false,
      status: null,
      badgeVariant: 'gray',
      badgeText: 'SLA pending',
      deadlineText: '',
      plannedText: `Planned: ${planned}m`,
    };
  }

  const remainingMs = deadlineMs - now;
  const isOverdue = remainingMs <= 0;
  const status = isOverdue ? 'OVERDUE' : remainingMs <= dueSoonMs ? 'DUE_SOON' : 'ON_TIME';

  const badgeVariant = status === 'OVERDUE' ? 'red' : status === 'DUE_SOON' ? 'orange' : 'green';
  const badgeText = isOverdue
    ? `OVERDUE by ${formatDurationMs(-remainingMs)}`
    : `${formatDurationMs(remainingMs)} left`;

  const deadlineText = `Due at: ${formatDueAt(deadlineMs, { timeZone }) || '-'}`;
  const plannedText = `Planned: ${planned}m`;

  return {
    stepName,
    plannedMinutes: planned,
    hasSla: true,
    reason: '',
    deadlineAt: new Date(deadlineMs).toISOString(),
    remainingMs,
    isOverdue,
    status,
    badgeVariant,
    badgeText,
    deadlineText,
    plannedText,
  };
}
