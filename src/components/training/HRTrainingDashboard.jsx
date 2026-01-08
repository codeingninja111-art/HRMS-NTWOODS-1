import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { trainingDashboard } from '../../api/training';
import { Spinner } from '../ui/Spinner';

function Stat({ label, value, color }) {
  return (
    <div className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
      <div className="small" style={{ color: 'var(--gray-500)' }}>{label}</div>
      <div style={{ fontWeight: 800, marginTop: 6, color: color || 'inherit' }}>{value}</div>
    </div>
  );
}

export function HRTrainingDashboard({ token, scope = 'PROBATION' }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await trainingDashboard(token, { scope });
      setData(res);
    } catch (e) {
      toast.error(e?.message || 'Failed to load training dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const totals = data?.totals || { TOTAL: 0, PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0 };

  const overdueTop = useMemo(() => {
    const list = Array.isArray(data?.candidates) ? data.candidates : [];
    return list.filter((x) => Number(x.OVERDUE || 0) > 0).slice(0, 8);
  }, [data]);

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800 }}>Training Dashboard</div>
          <div className="small" style={{ color: 'var(--gray-500)' }}>Counts by status (scope: {String(scope).toUpperCase()})</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="button" type="button" onClick={load} disabled={loading}>
            {loading ? <Spinner size={14} /> : null}
            Refresh
          </button>
        </div>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <Stat label="Total" value={totals.TOTAL || 0} />
        <Stat label="Pending" value={totals.PENDING || 0} color="#f59e0b" />
        <Stat label="In-Progress" value={totals.IN_PROGRESS || 0} color="#3b82f6" />
        <Stat label="Completed" value={totals.COMPLETED || 0} color="#22c55e" />
        <Stat label="Overdue" value={totals.OVERDUE || 0} color="#ef4444" />
      </div>

      {overdueTop.length ? (
        <div style={{ marginTop: 12 }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Overdue (top)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            {overdueTop.map((c) => (
              <div key={c.candidate_id} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                <div style={{ fontWeight: 700 }}>{c.candidate_name || c.candidate_id}</div>
                <div className="small" style={{ color: 'var(--gray-500)', marginTop: 2 }}>
                  Overdue: {c.OVERDUE} • Pending: {c.PENDING} • In-Progress: {c.IN_PROGRESS} • Completed: {c.COMPLETED}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
