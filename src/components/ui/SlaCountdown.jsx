import React from 'react';

import { cn } from '../../utils/cn';
import { useSlaCountdown } from '../../utils/useSlaCountdown';
import { Badge } from './Badge';

export function SlaCountdown({
  sla,
  stepKey,
  stepStartAt,
  plannedMinutes,
  deadlineAt,
  nowMs,
  timeZone = 'Asia/Kolkata',
  dueSoonMs = 10 * 60 * 1000,
  className,
  compact = false,
} = {}) {
  const st = useSlaCountdown({
    sla,
    stepKey,
    stepStartAt,
    plannedMinutes,
    deadlineAt,
    nowMs,
    timeZone,
    dueSoonMs,
    enabled: true,
  });

  // If backend didn't send SLA and caller didn't provide enough context, keep UI quiet.
  if (!sla && !stepKey && !plannedMinutes && !deadlineAt) return null;

  return (
    <div className={cn('sla', className)} style={{ display: 'grid', gap: 4, justifyItems: compact ? 'end' : 'start' }}>
      <Badge variant={st.badgeVariant}>{st.badgeText}</Badge>
      {st.hasSla ? (
        <div className="small" style={{ color: 'var(--gray-600)', textAlign: compact ? 'right' : 'left' }}>
          {st.deadlineText} | {st.plannedText}
        </div>
      ) : st.plannedText ? (
        <div className="small" style={{ color: 'var(--gray-600)', textAlign: compact ? 'right' : 'left' }}>
          {st.plannedText}
        </div>
      ) : null}
    </div>
  );
}
