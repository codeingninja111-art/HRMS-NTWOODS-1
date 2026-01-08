import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { precallList, precallUpdate } from '../api/candidates';
import { saveRejectRevertDraft } from '../utils/storage';
import { LoadingOverlay, Spinner } from '../components/ui/Spinner';
import { ExpandableCard } from '../components/ui/Collapsible';
import { ViewCvButton } from '../components/ui/ViewCvButton';
import { candidateDisplayName } from '../utils/pii';
import { SlaCountdown } from '../components/ui/SlaCountdown';

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fmtDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function PrecallPage() {
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

  const portalAllowed = allowPortal_('PORTAL_HR_PRECALL', ['HR', 'ADMIN']);

  const [date, setDate] = useState(todayIsoDate());
  const [jobRole, setJobRole] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [busyKey, setBusyKey] = useState('');

  const roleTabs = useMemo(() => {
    const roles = Array.from(new Set(items.map((x) => x.jobRole).filter(Boolean)));
    roles.sort((a, b) => String(a).localeCompare(String(b)));
    return ['ALL', ...roles];
  }, [items]);

  async function load(nextDate, nextRole) {
    if (!portalAllowed) return;
    if (!allowAction_('PRECALL_LIST', ['HR', 'ADMIN'])) return;
    setLoading(true);
    try {
      const payload = {
        date: nextDate,
        jobRole: nextRole && nextRole !== 'ALL' ? nextRole : '',
      };
      const res = await precallList(token, payload);
      // Only show candidates pending the call.
      // Once `preCallAt` is set (Call Done) they move to the next stage.
      // Once online test is submitted they should not stay here either.
      const list = res.items ?? [];
      setItems(list.filter((x) => !x.preCallAt && !x.onlineTestResult));
    } catch (e) {
      toast.error(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(date, jobRole);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, jobRole, portalAllowed]);

  // Live SLA countdown handled by SlaCountdown (shared tick).

  const filtered = useMemo(() => {
    if (jobRole === 'ALL') return items;
    return items.filter((x) => x.jobRole === jobRole);
  }, [items, jobRole]);

  const threshold = useMemo(() => {
    // backend returns threshold only on update; keep UI simple
    return null;
  }, []);

  async function onNotPick(it) {
    if (!allowAction_('PRECALL_UPDATE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${it.candidateId}:NOT_PICK`;
    setBusyKey(key);
    try {
      const res = await precallUpdate(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        op: 'NOT_PICK',
      });

      if (res.autoRejected || res.status === 'REJECTED') {
        saveRejectRevertDraft({ requirementId: it.requirementId, candidateId: it.candidateId });
        toast.success('Auto rejected (Not Pick threshold)');
        setItems((prev) => prev.filter((x) => x.candidateId !== it.candidateId));
        return;
      }

      toast.success('Marked Not Pick');
      setItems((prev) =>
        prev.map((x) => (x.candidateId === it.candidateId ? { ...x, notPickCount: res.notPickCount ?? (x.notPickCount ?? 0) + 1 } : x))
      );
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onCallDone(it) {
    if (!allowAction_('PRECALL_UPDATE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${it.candidateId}:CALL_DONE`;
    setBusyKey(key);
    try {
      const nowIso = new Date().toISOString();
      await precallUpdate(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        op: 'CALL_DONE',
        preCallAt: nowIso,
      });
      toast.success('Call marked done');
      // Moved to next stage, remove from this stage list.
      setItems((prev) => prev.filter((x) => x.candidateId !== it.candidateId));
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onReject(it) {
    if (!allowAction_('PRECALL_UPDATE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const remark = window.prompt('Reject remark (required):');
    if (remark == null) return;
    if (!String(remark).trim()) {
      toast.error('Remark required');
      return;
    }

    const key = `${it.candidateId}:REJECT`;
    setBusyKey(key);
    try {
      await precallUpdate(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        op: 'REJECT',
        remark: String(remark).trim(),
      });
      saveRejectRevertDraft({ requirementId: it.requirementId, candidateId: it.candidateId });
      toast.success('Rejected');
      setItems((prev) => prev.filter((x) => x.candidateId !== it.candidateId));
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  return (
    <AppLayout>
      {!portalAllowed ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Not allowed</div>
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have access to Precall portal.</div>
        </div>
      ) : null}
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">Pre-interview Calls</h1>
        <p className="page-subtitle">Track walk-in candidates and mark call status</p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label className="small" style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Walk-in Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="spacer" />
          <button className="button" onClick={() => load(date, jobRole)} disabled={loading}>
            {loading ? <><Spinner size={14} /> Refreshing...</> : '↻ Refresh'}
          </button>
          <span className="badge blue">{filtered.length} candidates</span>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '16px' }}>
        {roleTabs.map((r) => (
          <button
            key={r}
            className={['tab', jobRole === r ? 'active' : ''].join(' ')}
            onClick={() => setJobRole(r)}
            type="button"
          >
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingOverlay text="Loading candidates..." />
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📞</div>
          <p className="small">No scheduled walk-ins for this filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {filtered.map((it) => {
            const isBusy = busyKey.startsWith(it.candidateId);
            const name = candidateDisplayName(it);
            return (
              <div key={it.candidateId} className="card">
                <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '16px' }}>
                        {name || it.candidateId}
                        {name && it.candidateId ? (
                          <span className="small" style={{ fontWeight: 400, marginLeft: 8, color: 'var(--gray-500)' }}>
                            ({it.candidateId})
                          </span>
                        ) : null}
                      </div>
                      <span className="badge orange">Not Pick: {Number(it.notPickCount || 0)}</span>
                    </div>
                    <SlaCountdown sla={it.sla} />
                    <div className="small" style={{ display: 'grid', gap: '4px' }}>
                      <div><strong>Position:</strong> {it.jobTitle ? `${it.jobTitle} · ` : ''}{it.jobRole}</div>
                      <div><strong>Walk-in:</strong> {fmtDateTime(it.walkinAt)}</div>
                      {it.walkinNotes && <div><strong>Notes:</strong> {it.walkinNotes}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <ViewCvButton cvFileId={it.cvFileId} token={token} />
                    <button 
                      className="button" 
                      type="button" 
                      onClick={() => onNotPick(it)}
                      disabled={isBusy || !allowAction_('PRECALL_UPDATE', ['HR', 'ADMIN'])}
                    >
                      {busyKey === `${it.candidateId}:NOT_PICK` ? <Spinner size={14} /> : '📵'} Not Pick
                    </button>
                    <button 
                      className="button success" 
                      type="button" 
                      onClick={() => onCallDone(it)}
                        disabled={isBusy || !allowAction_('PRECALL_UPDATE', ['HR', 'ADMIN'])}
                    >
                      {busyKey === `${it.candidateId}:CALL_DONE` ? <Spinner size={14} /> : '✓'} Call Done
                    </button>
                    <button 
                      className="button danger" 
                      type="button" 
                      onClick={() => onReject(it)}
                        disabled={isBusy || !allowAction_('PRECALL_UPDATE', ['HR', 'ADMIN'])}
                    >
                      {busyKey === `${it.candidateId}:REJECT` ? <Spinner size={14} /> : '✕'} Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
