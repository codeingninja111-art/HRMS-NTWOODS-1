import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { candidateTestAssign, candidateTestReview, candidateTestSubmit, testsQueueList } from '../api/candidates';
import { usersList } from '../api/admin';
import { LoadingOverlay, Spinner } from '../components/ui/Spinner';
import { ViewCvButton } from '../components/ui/ViewCvButton';
import { candidateDisplayName } from '../utils/pii';
import { SlaCountdown } from '../components/ui/SlaCountdown';

function fmtDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function keyOf_(it) {
  const c = it?.candidateId || '';
  const t = it?.test?.testKey || '';
  return `${c}:${t}`;
}

export function TestsPage() {
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

  const portalAllowed = allowPortal_('PORTAL_TESTS', ['ADMIN', 'HR', 'EA', 'ACCOUNTS', 'MIS', 'DEO']);
  const canAssign = allowAction_('CANDIDATE_TEST_ASSIGN', ['ADMIN']);
  const canListUsers = allowAction_('USERS_LIST', ['ADMIN']);

  const [tab, setTab] = useState('FILL');
  const [loading, setLoading] = useState(false);
  const [fillItems, setFillItems] = useState([]);
  const [reviewItems, setReviewItems] = useState([]);
  const [busyKey, setBusyKey] = useState('');

  const [marksDraft, setMarksDraft] = useState({});
  const [remarksDraft, setRemarksDraft] = useState({});
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  async function load() {
    if (!portalAllowed) return;
    if (!allowAction_('TESTS_QUEUE_LIST', ['ADMIN', 'HR', 'EA', 'ACCOUNTS', 'MIS', 'DEO'])) return;
    setLoading(true);
    try {
      const [fill, review] = await Promise.all([
        testsQueueList(token, { mode: 'FILL' }),
        testsQueueList(token, { mode: 'REVIEW' }),
      ]);
      setFillItems(fill.items ?? []);
      setReviewItems(review.items ?? []);
    } catch (e) {
      toast.error(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalAllowed]);

  useEffect(() => {
    if (!portalAllowed) return;
    if (!canListUsers) return;
    setUsersLoading(true);
    usersList(token, { status: 'ACTIVE', page: 1, pageSize: 500 })
      .then((res) => setUsers(res?.items ?? []))
      .catch((e) => {
        setUsers([]);
        toast.error(e?.message || 'Failed to load users');
      })
      .finally(() => setUsersLoading(false));
  }, [portalAllowed, canListUsers, token]);

  const current = useMemo(() => (tab === 'REVIEW' ? reviewItems : fillItems), [tab, fillItems, reviewItems]);

  const usersByRole = useMemo(() => {
    const map = new Map();
    (users || []).forEach((u) => {
      const r = String(u?.role || '').toUpperCase();
      if (!r) return;
      if (!map.has(r)) map.set(r, []);
      map.get(r).push(u);
    });
    return map;
  }, [users]);

  function assigneeOptionsFor_(test) {
    const roles = Array.isArray(test?.fillRoles) ? test.fillRoles.map((x) => String(x || '').toUpperCase()).filter(Boolean) : [];
    if (!roles.length) return users || [];
    const out = [];
    roles.forEach((r) => (usersByRole.get(r) || []).forEach((u) => out.push(u)));
    const seen = new Set();
    return out.filter((u) => {
      const id = String(u?.userId || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  async function onAssignFill(it, fillOwnerUserId) {
    if (!canAssign) {
      toast.error('Not allowed');
      return;
    }
    const key = keyOf_(it);
    setBusyKey(`ASSIGN:${key}`);
    try {
      await candidateTestAssign(token, {
        candidateId: it.candidateId,
        testKey: it.test?.testKey,
        fillOwnerUserId: String(fillOwnerUserId || '').trim(),
      });
      toast.success('Assigned');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Failed to assign');
    } finally {
      setBusyKey('');
    }
  }

  async function onSubmit(it) {
    if (!allowAction_('CANDIDATE_TEST_SUBMIT', ['ADMIN', 'EA', 'ACCOUNTS', 'MIS', 'DEO'])) {
      toast.error('Not allowed');
      return;
    }
    const key = keyOf_(it);
    const rawMarks = marksDraft[key];
    const n = Number(rawMarks);
    if (!Number.isFinite(n)) {
      toast.error('Enter marks');
      return;
    }
    setBusyKey(key);
    try {
      await candidateTestSubmit(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        testKey: it.test?.testKey,
        marks: n,
        remarks: remarksDraft[key] ?? '',
      });
      toast.success('Submitted');
      setFillItems((prev) => prev.filter((x) => keyOf_(x) !== key));
      setTab('REVIEW');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onApprove(it) {
    if (!allowAction_('CANDIDATE_TEST_REVIEW', ['ADMIN', 'HR'])) {
      toast.error('Not allowed');
      return;
    }
    const key = keyOf_(it);
    setBusyKey(key);
    try {
      await candidateTestReview(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        testKey: it.test?.testKey,
        decision: 'APPROVE',
        remarks: remarksDraft[key] ?? '',
      });
      toast.success('Approved');
      setReviewItems((prev) => prev.filter((x) => keyOf_(x) !== key));
      await load();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onReject(it) {
    if (!allowAction_('CANDIDATE_TEST_REVIEW', ['ADMIN', 'HR'])) {
      toast.error('Not allowed');
      return;
    }
    const key = keyOf_(it);
    const remarks = String(remarksDraft[key] ?? '').trim();
    if (!remarks) {
      toast.error('Remarks required');
      return;
    }
    setBusyKey(key);
    try {
      await candidateTestReview(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        testKey: it.test?.testKey,
        decision: 'REJECT',
        remarks,
      });
      toast.success('Rejected');
      setReviewItems((prev) => prev.filter((x) => keyOf_(x) !== key));
      await load();
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
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have access to Tests.</div>
        </div>
      ) : null}

      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Tests</h1>
        <p className="page-subtitle">Fill marks and review required candidate tests (TestMaster driven)</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <button className="button" type="button" onClick={load} disabled={loading}>
            {loading ? <><Spinner size={14} /> Refreshing...</> : 'Refresh'}
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <span className="badge">Fill: {fillItems.length}</span>{' '}
            <span className="badge">Review: {reviewItems.length}</span>
          </div>
        </div>
        <div style={{ height: 12 }} />
        <div className="tabs">
          <button type="button" className={['tab', tab === 'FILL' ? 'active' : ''].join(' ')} onClick={() => setTab('FILL')}>
            To Fill ({fillItems.length})
          </button>
          <button type="button" className={['tab', tab === 'REVIEW' ? 'active' : ''].join(' ')} onClick={() => setTab('REVIEW')}>
            To Review ({reviewItems.length})
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingOverlay text="Loading..." />
      ) : current.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>✓</div>
          <div className="small">Nothing pending</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {current.map((it) => {
            const key = keyOf_(it);
            const t = it.test || {};
            const assignBusy = busyKey === `ASSIGN:${key}`;
            const options = assigneeOptionsFor_(t);
            const name = candidateDisplayName(it);
            return (
              <div key={key} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ minWidth: 240 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {name || it.candidateId}
                      {name && it.candidateId ? (
                        <span className="small" style={{ fontWeight: 400, marginLeft: 8, color: 'var(--gray-500)' }}>
                          ({it.candidateId})
                        </span>
                      ) : null}
                    </div>
                    <div className="small" style={{ color: 'var(--gray-500)', marginTop: 2 }}>
                      {it.jobTitle ? `${it.jobTitle} · ` : ''}{it.jobRole || '-'}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge">{t.label || t.testKey}</span>
                      <span className="badge">{String(t.status || '').toUpperCase()}</span>
                      {t.filledAt ? <span className="badge">Filled: {fmtDateTime(t.filledAt)}</span> : null}
                      {canAssign && tab === 'FILL' ? (
                        <span className="badge">{t.fillOwnerUserId ? `Assigned: ${t.fillOwnerUserId}` : 'Unassigned'}</span>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <SlaCountdown sla={it.sla} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <ViewCvButton cvFileId={it.cvFileId} token={token} />
                    {tab === 'FILL' ? (
                      <>
                        {canAssign ? (
                          <>
                            <select
                              value={String(t.fillOwnerUserId || '')}
                              onChange={(e) => onAssignFill(it, e.target.value)}
                              disabled={!!busyKey || usersLoading}
                              style={{ maxWidth: 220 }}
                            >
                              <option value="">{usersLoading ? 'Loading users...' : 'Unassigned'}</option>
                              {options.map((u) => (
                                <option key={u.userId} value={u.userId}>
                                  {u.fullName || u.userId} ({u.role}){u.email ? ` • ${u.email}` : ''}
                                </option>
                              ))}
                            </select>
                            {assignBusy ? <Spinner size={14} /> : null}
                          </>
                        ) : null}
                        <input
                          style={{ width: 100 }}
                          placeholder="Marks"
                          value={marksDraft[key] ?? ''}
                          onChange={(e) => setMarksDraft((p) => ({ ...p, [key]: e.target.value }))}
                        />
                        <input
                          style={{ width: 180 }}
                          placeholder="Remarks (optional)"
                          value={remarksDraft[key] ?? ''}
                          onChange={(e) => setRemarksDraft((p) => ({ ...p, [key]: e.target.value }))}
                        />
                        <button className="button primary" type="button" onClick={() => onSubmit(it)} disabled={!!busyKey}>
                          {busyKey === key ? <Spinner size={14} /> : null}
                          Submit
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="small" style={{ minWidth: 140 }}>
                          Marks: {t.marksNumber != null && t.marksNumber !== '' ? `${t.marksNumber}` : String(t.marks ?? '')}
                        </div>
                        <input
                          style={{ width: 220 }}
                          placeholder="Review remarks (required for reject)"
                          value={remarksDraft[key] ?? ''}
                          onChange={(e) => setRemarksDraft((p) => ({ ...p, [key]: e.target.value }))}
                        />
                        <button className="button" type="button" onClick={() => onApprove(it)} disabled={!!busyKey}>
                          {busyKey === key ? <Spinner size={14} /> : null}
                          Approve
                        </button>
                        <button className="button danger" type="button" onClick={() => onReject(it)} disabled={!!busyKey}>
                          {busyKey === key ? <Spinner size={14} /> : null}
                          Reject
                        </button>
                      </>
                    )}
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
