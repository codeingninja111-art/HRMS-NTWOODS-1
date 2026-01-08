import React from 'react';
import { TrainingCard } from './TrainingCard';

export function TrainingList({ items, token, loading, canUpdate, onStart, onComplete }) {
  const list = Array.isArray(items) ? items : [];

  if (loading) {
    return <div className="small">Loading trainings…</div>;
  }

  if (!list.length) {
    return <div className="small">No trainings assigned.</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
      {list.map((it) => (
        <TrainingCard
          key={it.assigned_id || `${it.candidate_id}:${it.training_id}`}
          item={it}
          token={token}
          canUpdate={!!canUpdate}
          onStart={onStart}
          onComplete={onComplete}
        />
      ))}
    </div>
  );
}
