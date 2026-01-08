import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { hrFinalHoldList, hrHoldSchedule } from '../api/candidates';
import { LoadingOverlay, Spinner } from '../components/ui/Spinner';
import { Collapsible } from '../components/ui/Collapsible';
import { SlaCountdown } from '../components/ui/SlaCountdown';
import { validateScheduleDateTimeLocal } from '../utils/scheduling';
import { openFile } from '../utils/files';
import { candidateDisplayName } from '../utils/pii';

function toDateTimeLocalValue(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fmtDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function FinalHoldPage() {
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

  const portalAllowed = allowPortal_('PORTAL_HR_FINAL_HOLD', ['HR', 'ADMIN']);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busyKey, setBusyKey] = useState('');

  async function refresh() {
    if (!portalAllowed) return;
    if (!allowAction_('HR_FINAL_HOLD_LIST', ['HR', 'ADMIN'])) return;
    setLoading(true);
    try {
      const res = await hrFinalHoldList(token);
      const next = res.items || [];
      setItems(next);

      setDrafts((prev) => {
        const copy = { ...prev };
        next.forEach((it) => {
          if (!copy[it.candidateId]) {
            copy[it.candidateId] = {
              finalHoldAt: toDateTimeLocalValue(it.finalHoldAt),
              remark: it.finalHoldRemark || '',
            };
          }
        });
        return copy;
      });
    } catch (e) {
      toast.error(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalAllowed]);

  const total = useMemo(() => items.length, [items]);

  async function schedule(it) {
    if (!allowAction_('HR_HOLD_SCHEDULE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const d = drafts[it.candidateId] || {};
    const raw = String(d.finalHoldAt || '').trim();
    if (!raw) {
      toast.error('Select date/time');
      return;
    }

    const v = validateScheduleDateTimeLocal(raw);
    if (!v.ok) {
      toast.error(v.message);
      return;
    }
    const dt = v.date;

    const key = `${it.candidateId}:SCHEDULE`;
    setBusyKey(key);
    try {
      await hrHoldSchedule(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        finalHoldAt: dt.toISOString(),
        remark: String(d.remark || '').trim(),
      });
      toast.success('Scheduled');
      setItems((prev) =>
        prev.map((x) => (x.candidateId === it.candidateId ? { ...x, finalHoldAt: dt.toISOString(), finalHoldRemark: String(d.remark || '').trim() } : x))
      );
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  function viewCv(candidate) {
    if (!candidate?.cvFileId) {
      toast.error('CV not available');
      return;
    }
    const ok = openFile(candidate.cvFileId, token);
    if (!ok) toast.error('Unable to open CV');
  }

  return (
    <AppLayout>
      {!portalAllowed ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Not allowed</div>
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have access to Final Hold portal.</div>
        </div>
      ) : null}
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">Final Hold Scheduling</h1>
        <p className="page-subtitle">Schedule final hold interviews for candidates</p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <button className="button" onClick={refresh} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <Spinner size={14} /> : null}
            Refresh
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <span className="badge">{total} candidates</span>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingOverlay text="Loading candidates..." />
      ) : (
        <Collapsible
          title="Final Hold Candidates"
          subtitle="Candidates awaiting final hold scheduling"
          badge={total}
          variant="card"
          defaultOpen={true}
        >
          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">No candidates in Final Hold</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              {items.map((it) => {
                const d = drafts[it.candidateId] || { finalHoldAt: '', remark: '' };
                const isBusy = busyKey === `${it.candidateId}:SCHEDULE`;

                return (
                  <div key={it.candidateId} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                    <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 260, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>
                          {candidateDisplayName(it) || it.candidateId}
                          {candidateDisplayName(it) && it.candidateId ? (
                            <span className="small" style={{ fontWeight: 400, marginLeft: 8, color: 'var(--gray-500)' }}>
                              ({it.candidateId})
                            </span>
                          ) : null}
                        </div>
                        <div className="small" style={{ color: 'var(--gray-500)', marginTop: 2 }}>
                          {it.jobTitle ? `${it.jobTitle} · ` : ''}{it.jobRole || '-'}
                        </div>
                        <SlaCountdown sla={it.sla} />
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span className="badge">Req: {it.requirementId}</span>
                          <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>
                            {String(it.status || '').toUpperCase()}
                          </span>
                        </div>
                        {it.finalHoldAt ? (
                          <div style={{ marginTop: 8 }}>
                            <span className="badge" style={{ background: '#22c55e', color: '#fff' }}>
                              📅 {fmtDateTime(it.finalHoldAt)}
                            </span>
                          </div>
                        ) : null}
                        {it.finalHoldRemark ? (
                          <div className="small" style={{ marginTop: 8, color: 'var(--gray-600)' }}>
                            Remark: {it.finalHoldRemark}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: 'grid', gap: 10, minWidth: 260 }}>
                        <label className="small" style={{ display: 'grid', gap: 4 }}>
                          <span style={{ fontWeight: 600 }}>Schedule date/time</span>
                          <input
                            type="datetime-local"
                            value={d.finalHoldAt}
                            onChange={(e) =>
                              setDrafts((p) => ({
                                ...p,
                                [it.candidateId]: { ...d, finalHoldAt: e.target.value },
                              }))
                            }
                          />
                        </label>

                        <label className="small" style={{ display: 'grid', gap: 4 }}>
                          <span style={{ fontWeight: 600 }}>Remark (optional)</span>
                          <input
                            value={d.remark}
                            onChange={(e) =>
                              setDrafts((p) => ({
                                ...p,
                                [it.candidateId]: { ...d, remark: e.target.value },
                              }))
                            }
                            placeholder="Enter remark"
                          />
                        </label>

                        <div className="action-grid">
                          <button className="button" type="button" onClick={() => viewCv(it)}>
                            📄 View CV
                          </button>
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => schedule(it)}
                            disabled={isBusy || !!busyKey || !allowAction_('HR_HOLD_SCHEDULE', ['HR', 'ADMIN'])}
                          >
                            {isBusy ? <Spinner size={14} /> : null}
                            Schedule
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Collapsible>
      )}
    </AppLayout>
  );
}
