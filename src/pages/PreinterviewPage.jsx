import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { precallList, preinterviewMarksSave, preinterviewStatus, testFailDecide, testLinkCreate } from '../api/candidates';
import { saveRejectRevertDraft } from '../utils/storage';
import { LoadingOverlay, Spinner } from '../components/ui/Spinner';
import { Collapsible } from '../components/ui/Collapsible';
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

function promptDatetimeLocal(message, initialDate) {
  const fallback = initialDate ? new Date(initialDate) : null;
  const pad = (n) => String(n).padStart(2, '0');
  const initial =
    fallback && !Number.isNaN(fallback.getTime())
      ? `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(fallback.getDate())}T${pad(fallback.getHours())}:${pad(
          fallback.getMinutes()
        )}`
      : '';
  const val = window.prompt(message + ' (YYYY-MM-DDTHH:mm):', initial);
  if (val == null) return null;
  const trimmed = String(val).trim();
  if (!trimmed) return '';
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) return 'INVALID';
  return dt.toISOString();
}

export function PreinterviewPage() {
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

  const portalAllowed = allowPortal_('PORTAL_HR_PREINTERVIEW', ['HR', 'ADMIN']);

  const [date, setDate] = useState(todayIsoDate());
  const [jobRole, setJobRole] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [marksDraft, setMarksDraft] = useState({});
  const [linkByCandidate, setLinkByCandidate] = useState({});
  const [busyKey, setBusyKey] = useState('');

  function isContinued_(it, testType) {
    try {
      const obj = JSON.parse(String(it?.testDecisionsJson || '{}'));
      const entry = obj?.[testType];
      return String(entry?.decision || '').toUpperCase() === 'CONTINUE';
    } catch {
      return false;
    }
  }

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
        mode: 'PREINTERVIEW',
      };
      const res = await precallList(token, payload);
      const list = res.items ?? [];

      // Phase 14 shows candidates whose pre-interview datetime is fixed.
      // We treat `preCallAt` as the pre-interview datetime (set in Phase 13 Call Done).
      // Once online test is submitted and PASSED, candidate moves forward to in-person pipeline.
      // If online test FAILs, HR must decide (Continue/Reject) and candidate stays here until decided.
      setItems(
        list.filter((x) => {
          if (!x.preCallAt) return false;
          const resU = String(x.onlineTestResult || '').toUpperCase();
          if (!resU) return true;
          if (resU === 'PASS') return false;
          if (resU === 'FAIL') return false;
          return false;
        })
      );
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

  const scheduled = useMemo(() => filtered.filter((x) => String(x.preInterviewStatus || '').toUpperCase() !== 'APPEARED'), [filtered]);
  const appeared = useMemo(() => filtered.filter((x) => String(x.preInterviewStatus || '').toUpperCase() === 'APPEARED'), [filtered]);

  async function onAppeared(it) {
    if (!allowAction_('PREINTERVIEW_STATUS', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${it.candidateId}:APPEARED`;
    setBusyKey(key);
    try {
      const res = await preinterviewStatus(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        op: 'APPEARED',
      });
      toast.success('Marked Appeared');
      setItems((prev) =>
        prev.map((x) => (x.candidateId === it.candidateId ? { ...x, preInterviewStatus: res.preInterviewStatus || 'APPEARED' } : x))
      );
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onReschedule(it) {
    if (!allowAction_('PREINTERVIEW_STATUS', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const nextIso = promptDatetimeLocal('New pre-interview date/time', it.preCallAt);
    if (nextIso == null) return;
    if (nextIso === 'INVALID') {
      toast.error('Invalid date/time');
      return;
    }
    if (nextIso === '') {
      toast.error('Date/time required');
      return;
    }

    const key = `${it.candidateId}:RESCHEDULE`;
    setBusyKey(key);
    try {
      const res = await preinterviewStatus(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        op: 'RESCHEDULE',
        preInterviewAt: nextIso,
      });
      toast.success('Rescheduled');
      setItems((prev) => prev.map((x) => (x.candidateId === it.candidateId ? { ...x, preCallAt: res.preInterviewAt || nextIso } : x)));
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onReject(it) {
    if (!allowAction_('PREINTERVIEW_STATUS', ['HR', 'ADMIN'])) {
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
      await preinterviewStatus(token, {
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

  async function onSaveMarks(it) {
    if (!allowAction_('PREINTERVIEW_MARKS_SAVE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const draft = marksDraft[it.candidateId];
    if (draft == null || String(draft).trim() === '') {
      toast.error('Enter marks');
      return;
    }

    const key = `${it.candidateId}:MARKS`;
    setBusyKey(key);
    try {
      const res = await preinterviewMarksSave(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        marks: String(draft).trim(),
      });
      toast.success('Marks saved');
      setItems((prev) => prev.map((x) => (x.candidateId === it.candidateId ? { ...x, preInterviewMarks: res.preInterviewMarks } : x)));
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onGenerateLink(it) {
    if (!allowAction_('TEST_LINK_CREATE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${it.candidateId}:LINK`;
    setBusyKey(key);
    try {
      const res = await testLinkCreate(token, { requirementId: it.requirementId, candidateId: it.candidateId });
      const url = `${window.location.origin}${window.location.pathname}#/test?token=${encodeURIComponent(res.token)}`;
      setLinkByCandidate((prev) => ({ ...prev, [it.candidateId]: { url, token: res.token, expiresAt: res.expiresAt } }));
      toast.success('Test link created');
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onOnlineTestContinue(it) {
    if (!allowAction_('TEST_FAIL_DECIDE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${it.candidateId}:ONLINE_CONTINUE`;
    setBusyKey(key);
    try {
      await testFailDecide(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        testType: 'ONLINE_TEST',
        decision: 'CONTINUE',
        remark: '',
        stageTag: 'Online Test',
        meta: { marks: { score: it.onlineTestScore, result: it.onlineTestResult } },
      });
      toast.success('Continued by HR');
      await load(date, jobRole);
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onOnlineTestReject(it) {
    if (!allowAction_('TEST_FAIL_DECIDE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const remark = window.prompt('Remark (required):', '');
    if (remark == null) return;
    const r = String(remark || '').trim();
    if (!r) {
      toast.error('Remark is required');
      return;
    }
    const key = `${it.candidateId}:ONLINE_REJECT`;
    setBusyKey(key);
    try {
      await testFailDecide(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        testType: 'ONLINE_TEST',
        decision: 'REJECT',
        remark: r,
        stageTag: 'Online Test',
        meta: { marks: { score: it.onlineTestScore, result: it.onlineTestResult } },
      });
      toast.success('Rejected');
      await load(date, jobRole);
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onCopyLink(it) {
    const link = linkByCandidate[it.candidateId]?.url;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  const fetchData = () => load(date, jobRole);

  return (
    <AppLayout>
      {!portalAllowed ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Not allowed</div>
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have access to Preinterview portal.</div>
        </div>
      ) : null}
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">Pre-interview Scheduled</h1>
        <p className="page-subtitle">Manage scheduled pre-interviews and enter marks</p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div className="small" style={{ marginBottom: 4 }}>Walk-in Date</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <button className="button" onClick={fetchData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <Spinner size={14} /> : null}
            Refresh
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <span className="badge">{filtered.length} candidates</span>
          </div>
        </div>

        <div style={{ height: 12 }} />
        <div className="tabs">
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
      </div>

      {loading ? (
        <LoadingOverlay text="Loading candidates..." />
      ) : (
        <>
          <Collapsible
            title="Scheduled Candidates"
            subtitle="Candidates with pre-interview date/time fixed (from Precall 'Call Done')"
            badge={scheduled.length}
            variant="card"
            defaultOpen={true}
          >
            {scheduled.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <div className="empty-state-text">No scheduled candidates</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                {scheduled.map((it) => {
                  const keyAppear = `${it.candidateId}:APPEARED`;
                  const keyResched = `${it.candidateId}:RESCHEDULE`;
                  const keyReject = `${it.candidateId}:REJECT`;
                  return (
                    <div key={it.candidateId} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                      <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
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
                          <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                            <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>
                              📅 {fmtDateTime(it.preCallAt)}
                            </span>
                            <SlaCountdown sla={it.sla} />
                          </div>
                        </div>

                        <div className="action-grid">
                          <ViewCvButton cvFileId={it.cvFileId} token={token} />
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => onAppeared(it)}
                            disabled={!!busyKey || !allowAction_('PREINTERVIEW_STATUS', ['HR', 'ADMIN'])}
                          >
                            {busyKey === keyAppear ? <Spinner size={14} /> : null}
                            Appeared
                          </button>
                          <button
                            className="button"
                            type="button"
                            onClick={() => onReschedule(it)}
                            disabled={!!busyKey || !allowAction_('PREINTERVIEW_STATUS', ['HR', 'ADMIN'])}
                          >
                            {busyKey === keyResched ? <Spinner size={14} /> : null}
                            Reschedule
                          </button>
                          <button
                            className="button danger"
                            type="button"
                            onClick={() => onReject(it)}
                            disabled={!!busyKey || !allowAction_('PREINTERVIEW_STATUS', ['HR', 'ADMIN'])}
                          >
                            {busyKey === keyReject ? <Spinner size={14} /> : null}
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Collapsible>

          <div style={{ height: 16 }} />

          <Collapsible
            title="Pre-interview Marks"
            subtitle="Only candidates marked Appeared"
            badge={appeared.length}
            variant="card"
            defaultOpen={true}
          >
            {appeared.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <div className="empty-state-text">No candidates ready for marks</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                {appeared.map((it) => {
                  const link = linkByCandidate[it.candidateId];
                  const keyMarks = `${it.candidateId}:MARKS`;
                  const keyLink = `${it.candidateId}:LINK`;
                  const onlineResU = String(it.onlineTestResult || '').toUpperCase();
                  const onlineContinued = onlineResU === 'FAIL' && isContinued_(it, 'ONLINE_TEST');
                  return (
                    <div key={it.candidateId} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                      <div className="row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 240 }}>
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
                          <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                            <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>
                              📅 {fmtDateTime(it.preCallAt)}
                            </span>
                            <SlaCountdown sla={it.sla} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                          <ViewCvButton cvFileId={it.cvFileId} token={token} />
                          <input
                            style={{ width: 100 }}
                            placeholder="Marks"
                            value={marksDraft[it.candidateId] ?? it.preInterviewMarks ?? ''}
                            onChange={(e) => setMarksDraft((p) => ({ ...p, [it.candidateId]: e.target.value }))}
                          />
                          <button
                            className="button"
                            type="button"
                            onClick={() => onSaveMarks(it)}
                            disabled={!!busyKey || !allowAction_('PREINTERVIEW_MARKS_SAVE', ['HR', 'ADMIN'])}
                          >
                            {busyKey === keyMarks ? <Spinner size={14} /> : null}
                            Save
                          </button>
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => onGenerateLink(it)}
                            disabled={
                              !!busyKey ||
                              !allowAction_('TEST_LINK_CREATE', ['HR', 'ADMIN']) ||
                              !!String(it.onlineTestSubmittedAt || '').trim()
                            }
                          >
                            {busyKey === keyLink ? <Spinner size={14} /> : null}
                            Generate Link
                          </button>
                          {link?.url ? (
                            <button className="button" type="button" onClick={() => onCopyLink(it)}>
                              📋 Copy
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {link?.url ? (
                        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--gray-100)', borderRadius: 'var(--radius)', fontSize: '13px', wordBreak: 'break-all' }}>
                          <strong>Test Link:</strong> {link.url}
                          {link.expiresAt ? <span style={{ color: 'var(--gray-500)' }}> (expires: {fmtDateTime(link.expiresAt)})</span> : ''}
                        </div>
                      ) : null}

                      {onlineResU ? (
                        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span
                            className="badge"
                            style={{
                              background: onlineResU === 'PASS' ? '#22c55e' : '#ef4444',
                              color: '#fff',
                            }}
                          >
                            Online Test: {onlineResU}{it.onlineTestScore !== '' && it.onlineTestScore != null ? ` (${it.onlineTestScore}/10)` : ''}
                          </span>
                          {onlineResU === 'FAIL' ? (
                            onlineContinued ? (
                              <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Continued by HR</span>
                            ) : (
                              <>
                                <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>Decision Required</span>
                                <button
                                  className="button"
                                  type="button"
                                  onClick={() => onOnlineTestContinue(it)}
                                  disabled={!!busyKey || !allowAction_('TEST_FAIL_DECIDE', ['HR', 'ADMIN'])}
                                >
                                  Continue
                                </button>
                                <button
                                  className="button danger"
                                  type="button"
                                  onClick={() => onOnlineTestReject(it)}
                                  disabled={!!busyKey || !allowAction_('TEST_FAIL_DECIDE', ['HR', 'ADMIN'])}
                                >
                                  Reject
                                </button>
                              </>
                            )
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Collapsible>
        </>
      )}
    </AppLayout>
  );
}
