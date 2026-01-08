import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { TrainingList } from '../components/training/TrainingList';
import { trainingList, updateTrainingStatus } from '../api/training';
import { Spinner } from '../components/ui/Spinner';

export function EmployeeTrainingPage() {
  const { token, me } = useAuth();

  const candidateId = String(me?.candidateId || '').trim();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const counts = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.reduce(
      (acc, x) => {
        const s = String(x?.status || '').toUpperCase();
        acc.TOTAL += 1;
        if (s === 'COMPLETED') acc.COMPLETED += 1;
        else if (s === 'IN_PROGRESS') acc.IN_PROGRESS += 1;
        else if (s === 'OVERDUE') acc.OVERDUE += 1;
        else acc.PENDING += 1;
        return acc;
      },
      { TOTAL: 0, PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0 }
    );
  }, [items]);

  async function refresh() {
    if (!candidateId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await trainingList(token, { candidateId });
      setItems(res.items ?? []);
    } catch (e) {
      toast.error(e?.message || 'Failed to load trainings');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  return (
    <AppLayout>
      <div className="card">
        <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>My Trainings</h2>
          <div className="spacer" />
          <button className="button" type="button" onClick={refresh} disabled={loading}>
            {loading ? <Spinner size={14} /> : null}
            Refresh
          </button>
        </div>

        <div style={{ height: 10 }} />
        <div className="small" style={{ color: 'var(--gray-600)' }}>
          Employee: <b>{me?.fullName || me?.employeeId || me?.userId || '-'}</b>
          {me?.jobRole ? ` • Role: ${me.jobRole}` : ''}
          {me?.jobTitle ? ` • ${me.jobTitle}` : ''}
        </div>
        <div className="small" style={{ color: 'var(--gray-500)', marginTop: 4 }}>
          Employee ID: <b>{me?.employeeId || me?.userId || '-'}</b>
        </div>

        <div style={{ height: 12 }} />
        {counts.TOTAL ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <span className="badge">Total: {counts.TOTAL}</span>
            <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Pending: {counts.PENDING}</span>
            <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>In-Progress: {counts.IN_PROGRESS}</span>
            <span className="badge" style={{ background: '#22c55e', color: '#fff' }}>Completed: {counts.COMPLETED}</span>
            <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>Overdue: {counts.OVERDUE}</span>
          </div>
        ) : null}

        <TrainingList
          items={items}
          token={token}
          loading={loading}
          canUpdate={true}
          onStart={async (item) => {
            try {
              await updateTrainingStatus(token, {
                candidate_id: candidateId,
                assigned_id: item.assigned_id,
                op: 'START',
                remarks: '',
              });
              toast.success('Marked In-Progress');
              await refresh();
            } catch (e) {
              toast.error(e?.message || 'Failed');
            }
          }}
          onComplete={async (item) => {
            try {
              await updateTrainingStatus(token, {
                candidate_id: candidateId,
                assigned_id: item.assigned_id,
                op: 'COMPLETE',
                remarks: '',
              });
              toast.success('Completed');
              await refresh();
            } catch (e) {
              toast.error(e?.message || 'Failed');
            }
          }}
        />

        {!candidateId ? (
          <div className="small" style={{ marginTop: 10, color: 'var(--danger)' }}>
            Candidate mapping not found for this Employee ID.
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
