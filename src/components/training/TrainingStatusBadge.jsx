import React from 'react';

function colorForStatus(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'COMPLETED') return { bg: '#22c55e', fg: '#fff' };
  if (s === 'IN_PROGRESS') return { bg: '#3b82f6', fg: '#fff' };
  if (s === 'OVERDUE') return { bg: '#ef4444', fg: '#fff' };
  return { bg: '#f59e0b', fg: '#fff' }; // PENDING
}

export function TrainingStatusBadge({ status }) {
  const s = String(status || '').toUpperCase() || 'PENDING';
  const c = colorForStatus(s);
  const label = s === 'IN_PROGRESS' ? 'In-Progress' : s.charAt(0) + s.slice(1).toLowerCase();

  return (
    <span className="badge" style={{ background: c.bg, color: c.fg }}>
      {label}
    </span>
  );
}
