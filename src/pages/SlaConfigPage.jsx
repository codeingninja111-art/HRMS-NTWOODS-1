import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { slaConfigGet, slaConfigUpsert } from '../api/admin';
import { hrRequirementsList } from '../api/requirements';
import { finalInterviewList, inpersonPipelineList, precallList, probationList, techPendingList } from '../api/candidates';
import { LoadingOverlay, Spinner } from '../components/ui/Spinner';
import { useNowTick } from '../utils/useNowTick';
import { deriveSlaCountdown, formatDueAt, toMs } from '../utils/sla';

const LIVE_SUPPORTED_STEPS = {
  HR_REVIEW: true,
  JOB_POSTING: true,
  ADD_CANDIDATE: true,
  PRECALL: true,
  PRE_INTERVIEW: true,
  IN_PERSON: true,
  TECHNICAL: true,
  FINAL_INTERVIEW: true,
  PROBATION: true,
};

export function SlaConfigPage() {
  const { token, role, legacyRole, canPortal, canAction } = useAuth();

  function allowPortal_(portalKey, fallbackRoles) {
    const v = typeof canPortal === 'function' ? canPortal(portalKey) : null;
    if (v === true || v === false) return v;
    const r = String(legacyRole || role || '').toUpperCase();
    return Array.isArray(fallbackRoles) ? fallbackRoles.includes(r) : false;
  }

  function allowAction_(actionKey, fallbackRoles) {
    const v = typeof canAction === 'function' ? canAction(actionKey) : null;
    if (v === true || v === false) return v;
    const r = String(legacyRole || role || '').toUpperCase();
    return Array.isArray(fallbackRoles) ? fallbackRoles.includes(r) : false;
  }

  const portalAllowed = allowPortal_('PORTAL_ADMIN_SLA', ['ADMIN']);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveStarts, setLiveStarts] = useState({});
  const [liveError, setLiveError] = useState('');
  const nowTick = useNowTick({ intervalMs: 1000, enabled: portalAllowed });

  async function load() {
    if (!portalAllowed) return;
    if (!allowAction_('SLA_CONFIG_GET', ['ADMIN'])) return;
    setLoading(true);
    try {
      const res = await slaConfigGet(token);
      setItems(res.items ?? []);
    } catch (e) {
      toast.error(e?.message || 'Failed to load SLA config');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalAllowed]);

  const sorted = useMemo(() => {
    const copy = Array.isArray(items) ? [...items] : [];
    copy.sort((a, b) => String(a.stepName || '').localeCompare(String(b.stepName || '')));
    return copy;
  }, [items]);

  async function loadLive() {
    if (!portalAllowed) return;
    setLiveLoading(true);
    setLiveError('');
    try {
      const tasks = [
        hrRequirementsList(token, { tab: 'REVIEW' }),
        hrRequirementsList(token, { tab: 'APPROVED' }),
        precallList(token, { date: '', jobRole: '' }),
        precallList(token, { date: '', jobRole: '', mode: 'PREINTERVIEW' }),
        inpersonPipelineList(token),
        techPendingList(token),
        finalInterviewList(token),
        probationList(token),
      ];

      const [
        reviewRes,
        approvedRes,
        precallRes,
        preInterviewRes,
        inpersonRes,
        techRes,
        finalRes,
        probationRes,
      ] = await Promise.all(tasks);

      const starts = {};
      const add = (step, ms) => {
        if (ms == null) return;
        if (!starts[step]) starts[step] = [];
        starts[step].push(ms);
      };

      // HR_REVIEW: requirements pending review (status SUBMITTED).
      (reviewRes?.items || []).forEach((r) => add('HR_REVIEW', toMs(r.updatedAt || r.createdAt)));

      const approved = approvedRes?.items || [];
      // JOB_POSTING: approved requirements whose job posting is not complete.
      approved
        .filter((r) => String(r.jobPostingStatus || '').toUpperCase() !== 'COMPLETE')
        .forEach((r) => add('JOB_POSTING', toMs(r.updatedAt || r.createdAt)));
      // ADD_CANDIDATE: job posting completed but no candidates added yet.
      approved
        .filter((r) => String(r.jobPostingStatus || '').toUpperCase() === 'COMPLETE' && Number(r.candidateCount || 0) === 0)
        .forEach((r) => add('ADD_CANDIDATE', toMs(r?.jobPostingState?.completedAt || r.updatedAt || r.createdAt)));

      // PRECALL: candidates pending call (no preCallAt, no online test submitted/result).
      (precallRes?.items || [])
        .filter((c) => !c.preCallAt && !c.onlineTestResult && !c.onlineTestSubmittedAt)
        .forEach((c) => add('PRECALL', toMs(c.walkinAt)));

      // PRE_INTERVIEW: candidates scheduled for pre-interview but not appeared yet (grace = planned minutes).
      (preInterviewRes?.items || [])
        .filter((c) => c.preCallAt && String(c.preInterviewStatus || '').toUpperCase() !== 'APPEARED' && !c.onlineTestResult && !c.onlineTestSubmittedAt)
        .forEach((c) => add('PRE_INTERVIEW', toMs(c.preCallAt)));

      // IN_PERSON: candidates eligible for in-person but marks not filled yet.
      (inpersonRes?.items || [])
        .filter((c) => !String(c.inPersonMarksAt || '').trim())
        .forEach((c) => add('IN_PERSON', toMs(c.onlineTestSubmittedAt)));

      // TECHNICAL: candidates with tech pending (start: techSelectedAt).
      (techRes?.items || []).forEach((c) => add('TECHNICAL', toMs(c.techSelectedAt || c.updatedAt)));

      // FINAL_INTERVIEW: candidates eligible for final (start: techEvaluatedAt).
      (finalRes?.items || []).forEach((c) => add('FINAL_INTERVIEW', toMs(c.techEvaluatedAt)));

      // PROBATION: candidates in probation (start: probationStartAt).
      (probationRes?.items || [])
        .filter((c) => String(c.status || '').toUpperCase() === 'PROBATION')
        .forEach((c) => add('PROBATION', toMs(c.probationStartAt)));

      setLiveStarts(starts);
    } catch (e) {
      setLiveStarts({});
      setLiveError(e?.message || 'Failed to load live SLA data');
    } finally {
      setLiveLoading(false);
    }
  }

  useEffect(() => {
    if (!portalAllowed) return;
    loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalAllowed]);

  async function onSave() {
    if (!allowAction_('SLA_CONFIG_UPSERT', ['ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    setBusy(true);
    try {
      await slaConfigUpsert(token, sorted);
      toast.success('Saved');
      await load();
      await loadLive();
    } catch (e) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function onRefreshAll() {
    await load();
    await loadLive();
  }

  return (
    <AppLayout>
      {!portalAllowed ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Not allowed</div>
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have access to SLA Config.</div>
        </div>
      ) : null}

      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">SLA Config</h1>
        <p className="page-subtitle">Configure planned minutes per step (used to compute breach in StepMetrics)</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="button" type="button" onClick={onRefreshAll} disabled={loading || busy || liveLoading}>
            {loading || liveLoading ? <><Spinner size={14} /> Refreshing...</> : 'Refresh'}
          </button>
          <button className="button primary" type="button" onClick={onSave} disabled={loading || busy}>
            {busy ? <><Spinner size={14} /> Saving...</> : 'Save'}
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <span className="badge">{sorted.length} steps</span>
          </div>
        </div>
        {liveError ? (
          <div className="small" style={{ color: '#ef4444', marginTop: 10 }}>{liveError}</div>
        ) : null}
      </div>

      {loading ? (
        <LoadingOverlay text="Loading..." />
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 10 }}>Step</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Planned Minutes</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Enabled</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Active</th>
                <th style={{ textAlign: 'left', padding: 10 }}>Oldest Timer</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((it, idx) => (
                <tr key={it.stepName || idx} style={{ borderTop: '1px solid var(--gray-200)' }}>
                  {(() => {
                    const step = String(it.stepName || '').toUpperCase();
                    const supported = !!LIVE_SUPPORTED_STEPS[step];
                    const planned = Number(it.plannedMinutes ?? 0);
                    const enabled = !!it.enabled;
                    const starts = supported ? (liveStarts[step] || []) : null;
                    const active = Array.isArray(starts) ? starts.length : null;

                    let oldest = null;
                    if (Array.isArray(starts) && starts.length) {
                      oldest = starts.reduce((min, v) => (typeof v === 'number' && v < min ? v : min), starts[0]);
                    }

                    const windowMs = planned > 0 ? planned * 60 * 1000 : 0;
                    const overdueCount =
                      enabled && windowMs > 0 && Array.isArray(starts) ? starts.filter((ms) => typeof ms === 'number' && nowTick - ms > windowMs).length : 0;

                    const countdown =
                      enabled && windowMs > 0 && oldest != null
                        ? deriveSlaCountdown({ stepKey: step, stepStartAt: oldest, plannedMinutes: planned, nowMs: nowTick })
                        : null;

                    return (
                      <>
                  <td style={{ padding: 10, fontWeight: 600 }}>{it.stepName}</td>
                  <td style={{ padding: 10 }}>
                    <input
                      type="number"
                      min="0"
                      value={it.plannedMinutes ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setItems((prev) =>
                          prev.map((x) => (x.stepName === it.stepName ? { ...x, plannedMinutes: Number.isFinite(v) ? v : 0 } : x))
                        );
                      }}
                      style={{ width: 140 }}
                    />
                  </td>
                  <td style={{ padding: 10 }}>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={!!it.enabled}
                        onChange={(e) =>
                          setItems((prev) => prev.map((x) => (x.stepName === it.stepName ? { ...x, enabled: e.target.checked } : x)))
                        }
                      />
                      <span className="small">Enabled</span>
                    </label>
                  </td>
                  <td style={{ padding: 10 }}>
                    {!supported ? (
                      <span className="small" style={{ color: 'var(--gray-500)' }}>—</span>
                    ) : liveLoading ? (
                      <Spinner size={14} />
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="badge">{active || 0} active</span>
                        {overdueCount ? (
                          <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>{overdueCount} overdue</span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 10 }}>
                    {!supported ? (
                      <span className="small" style={{ color: 'var(--gray-500)' }}>—</span>
                    ) : countdown == null ? (
                      <span className="small" style={{ color: 'var(--gray-500)' }}>
                        {enabled ? (planned > 0 ? 'No active' : 'Set planned minutes') : 'Disabled'}
                      </span>
                    ) : (
                      <div style={{ display: 'grid', gap: 4 }}>
                        <span
                          className="badge"
                          style={{
                            background:
                              countdown.badgeVariant === 'red'
                                ? '#ef4444'
                                : countdown.badgeVariant === 'orange'
                                  ? '#f59e0b'
                                  : countdown.badgeVariant === 'green'
                                    ? '#22c55e'
                                    : 'var(--gray-400)',
                            color: '#fff',
                            fontFamily: 'monospace',
                          }}
                        >
                          {countdown.badgeText}
                        </span>
                        {oldest != null ? (
                          <span className="small" style={{ color: 'var(--gray-500)' }}>
                            Oldest started: {formatDueAt(oldest) || '-'}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
