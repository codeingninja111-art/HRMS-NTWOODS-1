import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { reportsExportXlsx, reportsFunnel, reportsSummary } from '../api/reports';

function yyyyMmDd_(d) {
  const dt = d instanceof Date ? d : new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function downloadBlob_(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'report.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportsPage() {
  const { token } = useAuth();

  const [from, setFrom] = useState(() => {
    const now = new Date();
    return yyyyMmDd_(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [to, setTo] = useState(() => yyyyMmDd_(new Date()));
  const [department, setDepartment] = useState('');

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [funnel, setFunnel] = useState(null);

  const canRun = useMemo(() => Boolean(token && from && to), [token, from, to]);

  const loadSummary = useCallback(async () => {
    if (!canRun) return;
    setLoading(true);
    try {
      const data = await reportsSummary(token, { from, to });
      setSummary(data);
      toast.success('Summary loaded');
    } catch (err) {
      toast.error(err?.message ?? 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [canRun, token, from, to]);

  const loadFunnel = useCallback(async () => {
    if (!canRun) return;
    setLoading(true);
    try {
      const data = await reportsFunnel(token, { from, to, department: department || null });
      setFunnel(data);
      toast.success('Funnel loaded');
    } catch (err) {
      toast.error(err?.message ?? 'Failed to load funnel');
    } finally {
      setLoading(false);
    }
  }, [canRun, token, from, to, department]);

  const downloadSummary = useCallback(async () => {
    if (!canRun) return;
    setLoading(true);
    try {
      const blob = await reportsExportXlsx(token, { from, to, type: 'summary' });
      downloadBlob_(blob, `hrms_summary_${from}_${to}.xlsx`);
    } catch (err) {
      toast.error(err?.message ?? 'Failed to export summary');
    } finally {
      setLoading(false);
    }
  }, [canRun, token, from, to]);

  const downloadFunnel = useCallback(async () => {
    if (!canRun) return;
    setLoading(true);
    try {
      const blob = await reportsExportXlsx(token, { from, to, type: 'funnel', department: department || null });
      downloadBlob_(blob, `hrms_funnel_${from}_${to}.xlsx`);
    } catch (err) {
      toast.error(err?.message ?? 'Failed to export funnel');
    } finally {
      setLoading(false);
    }
  }, [canRun, token, from, to, department]);

  return (
    <AppLayout>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="small">From</div>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="small">To</div>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: 6, minWidth: 220 }}>
            <div className="small">Department (optional)</div>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Sales / HR / ..." />
          </div>

          <div className="spacer" />

          <button className="button" type="button" onClick={loadSummary} disabled={!canRun || loading}>
            Load Summary
          </button>
          <button className="button" type="button" onClick={loadFunnel} disabled={!canRun || loading}>
            Load Funnel
          </button>
          <button className="button primary" type="button" onClick={downloadSummary} disabled={!canRun || loading}>
            Export Summary (xlsx)
          </button>
          <button className="button primary" type="button" onClick={downloadFunnel} disabled={!canRun || loading}>
            Export Funnel (xlsx)
          </button>
        </div>
      </div>

      {summary ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Summary</h3>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <div>
              <div className="small" style={{ marginBottom: 8 }}>
                Requirements (total: {summary?.requirements?.total ?? 0})
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.requirements?.byStatus || []).map((r) => (
                    <tr key={r.status}>
                      <td>{r.status}</td>
                      <td style={{ textAlign: 'right' }}>{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="small" style={{ marginBottom: 8 }}>
                Candidates (total: {summary?.candidates?.total ?? 0})
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th style={{ textAlign: 'right' }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.candidates?.byStage || []).map((r) => (
                    <tr key={r.stage}>
                      <td>{r.stage}</td>
                      <td style={{ textAlign: 'right' }}>{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {funnel ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Funnel</h3>
          <div className="small" style={{ marginBottom: 8 }}>
            Total: {funnel?.total ?? 0}
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Stage</th>
                <th style={{ textAlign: 'right' }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {(funnel?.items || []).map((r) => (
                <tr key={r.stage}>
                  <td>{r.stage}</td>
                  <td style={{ textAlign: 'right' }}>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AppLayout>
  );
}

