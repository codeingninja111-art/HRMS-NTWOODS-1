import { useMemo } from 'react';

import { deriveSlaCountdown } from './sla';
import { useNowTick } from './useNowTick';

export function useSlaCountdown({
  sla,
  stepKey,
  stepStartAt,
  plannedMinutes,
  deadlineAt,
  nowMs,
  timeZone = 'Asia/Kolkata',
  dueSoonMs = 10 * 60 * 1000,
  enabled = true,
} = {}) {
  const hasNow = Number.isFinite(nowMs);
  const nowTick = useNowTick({ intervalMs: 1000, enabled: Boolean(enabled && !hasNow) });
  const effectiveNow = hasNow ? nowMs : nowTick;

  return useMemo(
    () =>
      deriveSlaCountdown({
        sla,
        stepKey,
        stepStartAt,
        plannedMinutes,
        deadlineAt,
        nowMs: effectiveNow,
        timeZone,
        dueSoonMs,
      }),
    [sla, stepKey, stepStartAt, plannedMinutes, deadlineAt, effectiveNow, timeZone, dueSoonMs]
  );
}

