import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { candidateTestsGet, ownerCandidatesList, ownerDecide, ownerFinalDecide, holdRevert } from '../api/candidates';
import { LoadingOverlay, Spinner } from '../components/ui/Spinner';
import { Collapsible } from '../components/ui/Collapsible';
import { validateScheduleDateTimeLocal } from '../utils/scheduling';
import { openFile } from '../utils/files';
import { candidateDisplayName } from '../utils/pii';

function fmtDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function badgeForStatus_(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'APPROVED') return { background: '#22c55e', color: '#fff' };
  if (s === 'REJECTED') return { background: '#ef4444', color: '#fff' };
  if (s === 'REVIEW_PENDING') return { background: '#f59e0b', color: '#fff' };
  if (s === 'PENDING') return { background: 'var(--gray-200)', color: 'var(--gray-800)' };
  return { background: 'var(--gray-100)', color: 'var(--gray-700)' };
}

function statusLabel_(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'APPROVED') return 'PASS';
  if (s === 'REJECTED') return 'FAIL';
  if (s === 'REVIEW_PENDING') return 'REVIEW PENDING';
  if (s === 'NOT_SELECTED') return 'NOT SELECTED';
  return s || '-';
}

export function OwnerPage() {
  const { token, legacyRole, canPortal, canAction, canUi } = useAuth();

  function allowPortal_(portalKey, fallbackRoles) {
    const v = typeof canPortal === 'function' ? canPortal(portalKey) : null;
    if (v === true || v === false) return v;
    const role = String(legacyRole || '').toUpperCase();
    const allowed = Array.isArray(fallbackRoles) ? fallbackRoles : [];
    return allowed.includes(role);
  }

  function allowAction_(actionKey, fallbackRoles) {
    const v = typeof canAction === 'function' ? canAction(actionKey) : null;
    if (v === true || v === false) return v;
    const role = String(legacyRole || '').toUpperCase();
    const allowed = Array.isArray(fallbackRoles) ? fallbackRoles : [];
    return allowed.includes(role);
  }

  function allowUi_(uiKey, fallbackRoles) {
    const v = typeof canUi === 'function' ? canUi(uiKey) : null;
    if (v === true || v === false) return v;
    const role = String(legacyRole || '').toUpperCase();
    const allowed = Array.isArray(fallbackRoles) ? fallbackRoles : [];
    return allowed.includes(role);
  }

  function isContinued_(c, testType) {
    try {
      const obj = JSON.parse(String(c?.testDecisionsJson || '{}'));
      const entry = obj?.[testType];
      return String(entry?.decision || '').toUpperCase() === 'CONTINUE';
    } catch {
      return false;
    }
  }

  const tabs = useMemo(
    () => [
      { key: 'APPROVE', label: 'Approve' },
      { key: 'FINAL', label: 'Final' },
    ],
    []
  );
  const [active, setActive] = useState('APPROVE');

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [testsByCandidate, setTestsByCandidate] = useState({});

  const [modal, setModal] = useState({ open: false, mode: 'OWNER', candidate: null });
  const [remark, setRemark] = useState('');
  const [holdUntil, setHoldUntil] = useState('');
  const [busyKey, setBusyKey] = useState('');

  async function loadCandidateTests_(list) {
    if (!allowAction_('CANDIDATE_TESTS_GET', ['OWNER', 'ADMIN'])) return;
    if (!Array.isArray(list) || list.length === 0) {
      setTestsByCandidate({});
      return;
    }

    const promises = list.map((it) =>
      candidateTestsGet(token, { requirementId: it.requirementId, candidateId: it.candidateId })
        .then((res) => [it.candidateId, res])
        .catch(() => null)
    );
    const results = await Promise.all(promises);
    const next = {};
    for (const row of results) {
      if (!row) continue;
      next[row[0]] = row[1];
    }
    setTestsByCandidate(next);
  }

  async function refresh() {
    if (!allowAction_('OWNER_CANDIDATES_LIST', ['OWNER', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    setLoading(true);
    try {
      const res = await ownerCandidatesList(token);
      const list = res.items || [];
      setItems(list);
      await loadCandidateTests_(list.filter((x) => String(x?.status || '').toUpperCase() === 'FINAL_OWNER_PENDING'));
    } catch (e) {
      toast.error(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openActions(candidate) {
    setModal({ open: true, mode: 'OWNER', candidate });
    setRemark('');
    setHoldUntil('');
  }

  function openFinalActions(candidate) {
    setModal({ open: true, mode: 'FINAL', candidate });
    setRemark('');
    setHoldUntil('');
  }

  function viewCv(candidate) {
    if (!candidate?.cvFileId) {
      toast.error('CV not available');
      return;
    }
    const ok = openFile(candidate.cvFileId, token);
    if (!ok) toast.error('Unable to open CV');
  }

  async function decideOwner(decision) {
    if (!allowAction_('OWNER_DECIDE', ['OWNER', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }

    if (decision === 'APPROVE_WALKIN' && !allowUi_('BTN_OWNER_APPROVE_WALKIN', ['OWNER', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }

    const c = modal.candidate;
    if (!c) return;

    const requirementId = c.requirementId;
    const candidateId = c.candidateId;

    const trimmedRemark = String(remark || '').trim();
    let holdDeadline = null;

    if (decision === 'REJECT' && !trimmedRemark) {
      toast.error('Remark required');
      return;
    }

    if (decision === 'HOLD') {
      if (!holdUntil) {
        toast.error('Select hold deadline');
        return;
      }
      const v = validateScheduleDateTimeLocal(holdUntil);
      if (!v.ok) {
        toast.error(v.message);
        return;
      }
      holdDeadline = v.date;
    }

    const key = `${candidateId}:${decision}`;
    setBusyKey(key);
    try {
      await ownerDecide(token, {
        requirementId,
        candidateId,
        decision: decision === 'APPROVE_WALKIN' ? 'APPROVE_WALKIN' : decision,
        remark: trimmedRemark,
        holdUntil: decision === 'HOLD' ? holdDeadline.toISOString() : undefined,
      });
      toast.success('Updated');
      setModal({ open: false, mode: 'OWNER', candidate: null });
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function decideFinal(decision) {
    if (!allowAction_('OWNER_FINAL_DECIDE', ['OWNER', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const c = modal.candidate;
    if (!c) return;

    const requirementId = c.requirementId;
    const candidateId = c.candidateId;

    const trimmedRemark = String(remark || '').trim();
    if (decision === 'REJECT' && !trimmedRemark) {
      toast.error('Remark required');
      return;
    }

    const key = `${candidateId}:FINAL:${decision}`;
    setBusyKey(key);
    try {
      await ownerFinalDecide(token, {
        requirementId,
        candidateId,
        decision,
        remark: trimmedRemark,
      });
      toast.success('Updated');
      setModal({ open: false, mode: 'FINAL', candidate: null });
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function finalSelect(candidate) {
    if (!allowAction_('OWNER_FINAL_DECIDE', ['OWNER', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${candidate.candidateId}:FINAL:SELECT`;
    setBusyKey(key);
    try {
      await ownerFinalDecide(token, {
        requirementId: candidate.requirementId,
        candidateId: candidate.candidateId,
        decision: 'SELECT',
        remark: '',
      });
      toast.success('Selected');
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function revertHold(candidate) {
    if (!allowAction_('HOLD_REVERT', ['OWNER', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${candidate.candidateId}:REVERT`;
    setBusyKey(key);
    try {
      await holdRevert(token, {
        requirementId: candidate.requirementId,
        candidateId: candidate.candidateId,
        remark: 'Revert',
      });
      toast.success('Reverted');
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Revert failed');
    } finally {
      setBusyKey('');
    }
  }

  const approveItems = items.filter((x) => {
    const st = String(x.status || '').toUpperCase();
    return st === 'OWNER' || st === 'OWNER_HOLD';
  });
  const finalItems = items.filter((x) => String(x.status || '').toUpperCase() === 'FINAL_OWNER_PENDING');

  return (
    <AppLayout>
      {!allowPortal_('PORTAL_OWNER', ['OWNER', 'ADMIN']) ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Not allowed</div>
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have access to Owner portal.</div>
        </div>
      ) : null}

      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">Owner Portal</h1>
        <p className="page-subtitle">Review and make decisions on candidates</p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <button className="button" onClick={refresh} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <Spinner size={14} /> : null}
            Refresh
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <span className="badge">{items.length} candidates</span>
          </div>
        </div>

        <div style={{ height: 12 }} />
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={['tab', active === t.key ? 'active' : ''].join(' ')}
              onClick={() => setActive(t.key)}
            >
              {t.label} ({t.key === 'APPROVE' ? approveItems.length : finalItems.length})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingOverlay text="Loading candidates..." />
      ) : (
        <>
          {active === 'APPROVE' ? (
            <Collapsible
              title="Candidates for Approval"
              subtitle="Approve, hold, or reject candidate applications"
              badge={approveItems.length}
              variant="card"
              defaultOpen={true}
            >
              {approveItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-text">No candidates pending approval</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {approveItems.map((c) => {
                    const st = String(c.status || '').toUpperCase();
                    const isHold = st === 'OWNER_HOLD';
                    const holdText = c.holdUntil ? new Date(c.holdUntil).toLocaleString() : '';

                    return (
                      <div key={c.candidateId} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                        <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '15px' }}>
                              {candidateDisplayName(c) || c.candidateId}
                              {candidateDisplayName(c) && c.candidateId ? (
                                <span className="small" style={{ fontWeight: 400, marginLeft: 8, color: 'var(--gray-500)' }}>
                                  ({c.candidateId})
                                </span>
                              ) : null}
                            </div>
                            <div className="small" style={{ color: 'var(--gray-500)', marginTop: 2 }}>
                              {c.jobRole || '-'} · {c.source || '-'}
                            </div>
                            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span className="badge">Req: {c.requirementId}</span>
                              <span className="badge" style={{ background: isHold ? '#f59e0b' : 'var(--primary)', color: '#fff' }}>
                                {st}
                              </span>
                            </div>
                            {isHold && holdText && (
                              <div className="small" style={{ marginTop: 6, color: 'var(--gray-600)' }}>
                                ⏰ Hold deadline: {holdText}
                              </div>
                            )}
                          </div>

                          <div className="action-grid">
                            <button className="button" type="button" onClick={() => viewCv(c)}>
                              📄 CV
                            </button>
                            {isHold ? (
                              <button
                                className="button"
                                type="button"
                                onClick={() => revertHold(c)}
                                disabled={!!busyKey || !allowAction_('HOLD_REVERT', ['OWNER', 'ADMIN'])}
                              >
                                {busyKey === `${c.candidateId}:REVERT` ? <Spinner size={14} /> : null}
                                Revert
                              </button>
                            ) : (
                              <button
                                className="button primary"
                                type="button"
                                onClick={() => {
                                  if (!allowAction_('OWNER_DECIDE', ['OWNER', 'ADMIN'])) {
                                    toast.error('Not allowed');
                                    return;
                                  }
                                  openActions(c);
                                }}
                                disabled={!allowAction_('OWNER_DECIDE', ['OWNER', 'ADMIN'])}
                              >
                                Actions
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Collapsible>
          ) : (
            <Collapsible
              title="Final Decision"
              subtitle="Make final hiring decisions for candidates"
              badge={finalItems.length}
              variant="card"
              defaultOpen={true}
            >
              {finalItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">⚖️</div>
                  <div className="empty-state-text">No candidates pending final decision</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {finalItems.map((c) => {
                    const reqTests = testsByCandidate?.[c.candidateId]?.requiredTests ?? [];
                    return (
                      <div key={c.candidateId} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                        <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 280, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '15px' }}>
                              {candidateDisplayName(c) || c.candidateId}
                              {candidateDisplayName(c) && c.candidateId ? (
                                <span className="small" style={{ fontWeight: 400, marginLeft: 8, color: 'var(--gray-500)' }}>
                                  ({c.candidateId})
                                </span>
                              ) : null}
                            </div>
                            <div className="small" style={{ color: 'var(--gray-500)', marginTop: 2 }}>
                              {c.jobTitle ? `${c.jobTitle} · ` : ''}{c.jobRole || '-'}
                            </div>
                            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span className="badge">Req: {c.requirementId}</span>
                              <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>
                                Final Decision
                              </span>
                            </div>

                            {/* Scores */}
                            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--gray-100)', borderRadius: 'var(--radius)' }}>
                              <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Scores</div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <span
                                  className="badge"
                                  style={{
                                    background: String(c.onlineTestResult || '').toUpperCase() === 'PASS' ? '#22c55e' : String(c.onlineTestResult || '').toUpperCase() === 'FAIL' ? '#ef4444' : undefined,
                                    color: String(c.onlineTestResult || '').toUpperCase() ? '#fff' : undefined,
                                  }}
                                >
                                  Online Test: {(c.onlineTestScore === '' || c.onlineTestScore == null) ? '-' : c.onlineTestScore}{c.onlineTestResult ? ` (${String(c.onlineTestResult).toUpperCase()})` : ''}
                                </span>
                                {String(c.onlineTestResult || '').toUpperCase() === 'FAIL' && isContinued_(c, 'ONLINE_TEST') ? (
                                  <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Continued by HR</span>
                                ) : null}
                                {c.preInterviewMarks && <span className="badge">Pre-interview: {c.preInterviewMarks}</span>}
                                {c.inPersonMarks && <span className="badge">In-person: {c.inPersonMarks}</span>}
                              </div>

                              <div className="small" style={{ marginTop: 8, fontWeight: 600 }}>Required Tests</div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                                {Array.isArray(reqTests) && reqTests.length ? (
                                  reqTests.map((rt) => (
                                    <span key={rt.testKey} className="badge" style={badgeForStatus_(rt.status)}>
                                      {rt.label || rt.testKey}: {statusLabel_(rt.status)}
                                      {rt.marksNumber != null ? ` (${rt.marksNumber}/10)` : ''}
                                    </span>
                                  ))
                                ) : (
                                  <span className="badge">No required tests</span>
                                )}
                              </div>

                              {Array.isArray(reqTests) && reqTests.length ? (
                                <div className="small" style={{ marginTop: 6, display: 'grid', gap: 4 }}>
                                  {reqTests.map((rt) => (
                                    <div key={rt.testKey}>
                                      <span style={{ fontWeight: 600 }}>{rt.label || rt.testKey}</span>
                                      {rt.filledAt ? ` · Filled: ${rt.filledBy || '-'} (${fmtDateTime(rt.filledAt)})` : ''}
                                      {rt.reviewedAt ? ` · Reviewed: ${rt.reviewedBy || '-'} (${fmtDateTime(rt.reviewedAt)})` : ''}
                                      {rt.remarks ? ` · ${rt.remarks}` : ''}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="action-grid" style={{ minWidth: 180 }}>
                            <button className="button" type="button" onClick={() => viewCv(c)}>
                              📄 CV
                            </button>
                            <button
                              className="button primary"
                              type="button"
                              onClick={() => finalSelect(c)}
                              disabled={!!busyKey || !allowAction_('OWNER_FINAL_DECIDE', ['OWNER', 'ADMIN'])}
                            >
                              {busyKey === `${c.candidateId}:FINAL:SELECT` ? <Spinner size={14} /> : null}
                              Select
                            </button>
                            <button
                              className="button"
                              type="button"
                              onClick={() => {
                                if (!allowAction_('OWNER_FINAL_DECIDE', ['OWNER', 'ADMIN'])) {
                                  toast.error('Not allowed');
                                  return;
                                }
                                openFinalActions(c);
                              }}
                              disabled={!allowAction_('OWNER_FINAL_DECIDE', ['OWNER', 'ADMIN'])}
                            >
                              Hold / Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Collapsible>
          )}
        </>
      )}

      {/* Modal */}
      {modal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 60,
          }}
          onClick={() => setModal({ open: false, mode: 'OWNER', candidate: null })}
        >
          <div
            className="card"
            style={{
              width: 'min(520px, 95vw)',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>
              {modal.mode === 'FINAL' ? 'Owner Final Decision' : 'Owner Decision'}
            </h3>
            <div className="small" style={{ color: 'var(--gray-500)', marginBottom: 16 }}>
              {candidateDisplayName(modal.candidate) || modal.candidate?.candidateId}
              {candidateDisplayName(modal.candidate) && modal.candidate?.candidateId
                ? ` (${modal.candidate.candidateId})`
                : ''}
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {modal.mode !== 'FINAL' && (
                <div>
                  <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Hold deadline (required for Hold)
                  </label>
                  <input
                    type="datetime-local"
                    value={holdUntil}
                    onChange={(e) => setHoldUntil(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div>
                <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Remark (required for Reject)
                </label>
                <textarea
                  rows={3}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  style={{ width: '100%' }}
                  placeholder="Enter remark..."
                />
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {modal.mode === 'FINAL' ? (
                <>
                  <button
                    className="button"
                    type="button"
                    onClick={() => decideFinal('HOLD')}
                    disabled={!!busyKey}
                  >
                    {busyKey === `${modal.candidate?.candidateId}:FINAL:HOLD` ? <Spinner size={14} /> : null}
                    Hold
                  </button>
                  <button
                    className="button danger"
                    type="button"
                    onClick={() => decideFinal('REJECT')}
                    disabled={!!busyKey}
                  >
                    {busyKey === `${modal.candidate?.candidateId}:FINAL:REJECT` ? <Spinner size={14} /> : null}
                    Reject
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="button primary"
                    type="button"
                    onClick={() => decideOwner('APPROVE_WALKIN')}
                    disabled={!!busyKey || !allowAction_('OWNER_DECIDE', ['OWNER', 'ADMIN']) || !allowUi_('BTN_OWNER_APPROVE_WALKIN', ['OWNER', 'ADMIN'])}
                  >
                    {busyKey === `${modal.candidate?.candidateId}:APPROVE_WALKIN` ? <Spinner size={14} /> : null}
                    Approve
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() => decideOwner('HOLD')}
                    disabled={!!busyKey || !allowAction_('OWNER_DECIDE', ['OWNER', 'ADMIN'])}
                  >
                    {busyKey === `${modal.candidate?.candidateId}:HOLD` ? <Spinner size={14} /> : null}
                    Hold
                  </button>
                  <button
                    className="button danger"
                    type="button"
                    onClick={() => decideOwner('REJECT')}
                    disabled={!!busyKey || !allowAction_('OWNER_DECIDE', ['OWNER', 'ADMIN'])}
                  >
                    {busyKey === `${modal.candidate?.candidateId}:REJECT` ? <Spinner size={14} /> : null}
                    Reject
                  </button>
                </>
              )}
              <button
                className="button"
                type="button"
                onClick={() => setModal({ open: false, mode: 'OWNER', candidate: null })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
