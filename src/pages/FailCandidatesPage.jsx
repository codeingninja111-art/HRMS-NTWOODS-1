import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { failCandidatesList, testFailDecide } from '../api/candidates';
import { LoadingOverlay, Spinner } from '../components/ui/Spinner';
import { Collapsible } from '../components/ui/Collapsible';
import { ViewCvButton } from '../components/ui/ViewCvButton';
import { candidateDisplayName } from '../utils/pii';

function fmtDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function FailCandidatesPage() {
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

  const portalAllowed = allowPortal_('PORTAL_FAIL_CANDIDATES', ['HR', 'ADMIN']);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [busyKey, setBusyKey] = useState('');

  async function load() {
    if (!portalAllowed) return;
    if (!allowAction_('FAIL_CANDIDATES_LIST', ['HR', 'ADMIN'])) return;
    setLoading(true);
    try {
      const res = await failCandidatesList(token, { stageName: 'ONLINE_TEST', includeResolved: false });
      setItems(res.items ?? []);
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

  const count = useMemo(() => items.length, [items]);

  async function onContinue(it) {
    if (!allowAction_('TEST_FAIL_DECIDE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${it.candidateId}:CONTINUE`;
    setBusyKey(key);
    try {
      await testFailDecide(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        testType: 'ONLINE_TEST',
        decision: 'CONTINUE',
        remark: '',
        stageTag: 'Online Test',
        meta: { score: it.score ?? null },
      });
      toast.success('Continued');
      setItems((prev) => prev.filter((x) => x.candidateId !== it.candidateId));
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onReject(it) {
    if (!allowAction_('TEST_FAIL_DECIDE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const remark = window.prompt('Reject remark (required):', '');
    if (!remark) return;

    const key = `${it.candidateId}:REJECT`;
    setBusyKey(key);
    try {
      await testFailDecide(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        testType: 'ONLINE_TEST',
        decision: 'REJECT',
        remark,
        stageTag: 'Online Test',
        meta: { score: it.score ?? null },
      });
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
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have access to Fail Candidates.</div>
        </div>
      ) : null}

      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">Fail Candidates</h1>
        <p className="page-subtitle">Candidates who failed Online Test</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <button className="button" type="button" onClick={load} disabled={loading}>
            {loading ? <><Spinner size={14} /> Refreshing...</> : 'Refresh'}
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <span className="badge">{count} candidates</span>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingOverlay text="Loading..." />
      ) : (
        <Collapsible
          title="Online Test FAIL"
          subtitle="Continue or Reject (audited)"
          badge={count}
          variant="card"
          defaultOpen={true}
        >
          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✓</div>
              <div className="empty-state-text">No failed candidates</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              {items.map((it) => {
                const keyC = `${it.candidateId}:CONTINUE`;
                const keyR = `${it.candidateId}:REJECT`;
                return (
                  <div key={it.id || it.candidateId} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                    <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
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
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>
                            FAIL{it.score != null && it.score !== '' ? ` (${it.score})` : ''}
                          </span>
                          {it.failedAt ? <span className="badge">Failed: {fmtDateTime(it.failedAt)}</span> : null}
                          {it.reason ? <span className="badge">{it.reason}</span> : null}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <ViewCvButton cvFileId={it.cvFileId} token={token} />
                        <button className="button" type="button" onClick={() => onContinue(it)} disabled={!!busyKey}>
                          {busyKey === keyC ? <Spinner size={14} /> : null}
                          Continue
                        </button>
                        <button className="button danger" type="button" onClick={() => onReject(it)} disabled={!!busyKey}>
                          {busyKey === keyR ? <Spinner size={14} /> : null}
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
      )}
    </AppLayout>
  );
}
