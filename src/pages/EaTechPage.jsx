import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { adminExcelMarksSubmit, eaTechMarksSubmit, techPendingList, testFailDecide } from '../api/candidates';
import { saveRejectRevertDraft } from '../utils/storage';
import { LoadingOverlay, Spinner } from '../components/ui/Spinner';
import { Collapsible } from '../components/ui/Collapsible';
import { SlaCountdown } from '../components/ui/SlaCountdown';
import { ViewCvButton } from '../components/ui/ViewCvButton';
import { candidateDisplayName } from '../utils/pii';

function fmtDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function EaTechPage() {
  const { token, role, canUi, canAction } = useAuth();

  // Permission keys (dynamic):
  // - UI: SECTION_EXCEL_MARKS
  // - ACTION: EA_TECH_MARKS_SUBMIT, ADMIN_EXCEL_MARKS_SUBMIT
  const canEaSubmit = (canAction && canAction('EA_TECH_MARKS_SUBMIT')) ?? (role === 'EA' || role === 'ADMIN');
  const canExcelUi = (canUi && canUi('SECTION_EXCEL_MARKS')) ?? role === 'ADMIN';
  const canExcelAction = (canAction && canAction('ADMIN_EXCEL_MARKS_SUBMIT')) ?? role === 'ADMIN';
  const canExcel = Boolean(canExcelUi && canExcelAction);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({});
  const [busyKey, setBusyKey] = useState('');
  const [decisionCtx, setDecisionCtx] = useState(null);
  const [decisionRemark, setDecisionRemark] = useState('');

  function isContinued_(it, testType) {
    try {
      const obj = JSON.parse(String(it?.testDecisionsJson || '{}'));
      const entry = obj?.[testType];
      return String(entry?.decision || '').toUpperCase() === 'CONTINUE';
    } catch {
      return false;
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await techPendingList(token);
      const list = res.items ?? [];
      setItems(list);

      const nextDraft = {};
      for (const it of list) {
        nextDraft[it.candidateId] = {
          tallyMarks: it.tallyMarks ?? '',
          voiceMarks: it.voiceMarks ?? '',
          excelMarks: it.excelMarks ?? '',
          review: '',
        };
      }
      setDraft(nextDraft);
    } catch (e) {
      toast.error(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = useMemo(() => items, [items]);
  const techFailDecisionRequired = useMemo(
    () =>
      pending.filter((it) => {
        const techResU = String(it.techResult || '').toUpperCase();
        if (techResU !== 'FAIL') return false;
        return !isContinued_(it, 'TECHNICAL');
      }),
    [pending]
  );
  const pendingNonDecision = useMemo(
    () =>
      pending.filter((it) => {
        const techResU = String(it.techResult || '').toUpperCase();
        if (techResU !== 'FAIL') return true;
        return isContinued_(it, 'TECHNICAL');
      }),
    [pending]
  );

  function setField(candidateId, key, value) {
    setDraft((p) => ({ ...p, [candidateId]: { ...(p[candidateId] || {}), [key]: value } }));
  }

  async function onSubmitEa(it) {
    if (!canEaSubmit) {
      toast.error('Not allowed');
      return;
    }
    const d = draft[it.candidateId] || {};
    const review = String(d.review || '').trim();
    if (!review) {
      toast.error('Test Review is required');
      return;
    }
    const key = `${it.candidateId}:EA`;
    setBusyKey(key);

    try {
      const res = await eaTechMarksSubmit(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        tallyMarks: d.tallyMarks === '' ? null : Number(d.tallyMarks),
        voiceMarks: d.voiceMarks === '' ? null : Number(d.voiceMarks),
        review,
      });

      if (res.techResult === 'FAIL' && res.decisionRequired) {
        toast.error('Technical FAIL — HR decision required');
        setDecisionCtx({
          requirementId: it.requirementId,
          candidateId: it.candidateId,
          candidateName: it.candidateName,
          candidateNameFull: it.candidateNameFull,
          mobile: it.mobile,
          mobileFull: it.mobileFull,
          testType: res.testType || 'TECHNICAL',
          stageTag: res.stageTag || 'Technical Tests',
          failed: res.failed || null,
          marks: { tallyMarks: d.tallyMarks, voiceMarks: d.voiceMarks, excelMarks: d.excelMarks },
        });
        setDecisionRemark('');
        return;
      }

      if (res.techResult === 'PASS') {
        toast.success('Technical PASS');
        setItems((prev) => prev.filter((x) => x.candidateId !== it.candidateId));
        return;
      }

      toast.success('Saved');
      // remain pending if missing excel etc
      await load();
    } catch (e) {
      toast.error(e?.message || 'Submit failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onSubmitExcel(it) {
    if (!canExcel) {
      toast.error('Not allowed');
      return;
    }
    const d = draft[it.candidateId] || {};
    const review = String(d.review || '').trim();
    if (!review) {
      toast.error('Test Review is required');
      return;
    }
    const n = Number(d.excelMarks);
    if (!Number.isFinite(n)) {
      toast.error('Enter Excel marks (0-10)');
      return;
    }

    const key = `${it.candidateId}:EXCEL`;
    setBusyKey(key);

    try {
      const res = await adminExcelMarksSubmit(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        excelMarks: n,
        review,
      });

      if (res.techResult === 'FAIL' && res.decisionRequired) {
        toast.error('Technical FAIL — HR decision required');
        setDecisionCtx({
          requirementId: it.requirementId,
          candidateId: it.candidateId,
          candidateName: it.candidateName,
          candidateNameFull: it.candidateNameFull,
          mobile: it.mobile,
          mobileFull: it.mobileFull,
          testType: res.testType || 'TECHNICAL',
          stageTag: res.stageTag || 'Technical Tests',
          failed: res.failed || null,
          marks: { tallyMarks: d.tallyMarks, voiceMarks: d.voiceMarks, excelMarks: d.excelMarks },
        });
        setDecisionRemark('');
        return;
      }

      if (res.techResult === 'PASS') {
        toast.success('Technical PASS');
        setItems((prev) => prev.filter((x) => x.candidateId !== it.candidateId));
        return;
      }

      toast.success('Excel saved');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Submit failed');
    } finally {
      setBusyKey('');
    }
  }

  return (
    <AppLayout>
      {decisionCtx ? (
        <div className="card" style={{ marginBottom: 12, border: '1px solid var(--gray-200)' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Test FAILED — HR decision required</div>
          <div className="small" style={{ color: 'var(--gray-600)', marginBottom: 10 }}>
            {candidateDisplayName(decisionCtx) || decisionCtx.candidateId} · {decisionCtx.stageTag}
          </div>

          <div className="small" style={{ marginBottom: 6, fontWeight: 700 }}>Remark (required only if Reject)</div>
          <textarea value={decisionRemark} onChange={(e) => setDecisionRemark(e.target.value)} rows={2} style={{ width: '100%' }} />

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              className="button"
              type="button"
              onClick={async () => {
                try {
                  await testFailDecide(token, {
                    requirementId: decisionCtx.requirementId,
                    candidateId: decisionCtx.candidateId,
                    testType: decisionCtx.testType,
                    decision: 'CONTINUE',
                    remark: String(decisionRemark || '').trim(),
                    stageTag: decisionCtx.stageTag,
                    meta: { failed: decisionCtx.failed, marks: decisionCtx.marks },
                  });
                  toast.success('Override applied (Continued)');
                  setDecisionCtx(null);
                  setDecisionRemark('');
                  await load();
                } catch (e) {
                  toast.error(e?.message || 'Failed');
                }
              }}
              disabled={!!busyKey}
            >
              Continue
            </button>
            <button
              className="button danger"
              type="button"
              onClick={async () => {
                const r = String(decisionRemark || '').trim();
                if (!r) {
                  toast.error('Remark is required to Reject');
                  return;
                }
                try {
                  await testFailDecide(token, {
                    requirementId: decisionCtx.requirementId,
                    candidateId: decisionCtx.candidateId,
                    testType: decisionCtx.testType,
                    decision: 'REJECT',
                    remark: r,
                    stageTag: decisionCtx.stageTag,
                    meta: { failed: decisionCtx.failed, marks: decisionCtx.marks },
                  });
                  saveRejectRevertDraft({ requirementId: decisionCtx.requirementId, candidateId: decisionCtx.candidateId });
                  toast.success('Rejected');
                  setDecisionCtx(null);
                  setDecisionRemark('');
                  await load();
                } catch (e) {
                  toast.error(e?.message || 'Failed');
                }
              }}
              disabled={!!busyKey}
            >
              Reject
            </button>

            <button className="button" type="button" onClick={() => setDecisionCtx(null)} disabled={!!busyKey}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">Pending Technical Tests</h1>
        <p className="page-subtitle">EA submits Tally/Voice marks. Excel marks require permission.</p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <button className="button" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <Spinner size={14} /> : null}
            Refresh
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <span className="badge">{pending.length} candidates</span>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingOverlay text="Loading candidates..." />
      ) : (
        <>
          <Collapsible
            title="Technical FAIL (Decision Required)"
            subtitle="Candidates with Technical FAIL must be Continued/Rejected by HR"
            badge={techFailDecisionRequired.length}
            variant="card"
            defaultOpen={techFailDecisionRequired.length > 0}
          >
            {techFailDecisionRequired.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-text">No pending decisions</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                {techFailDecisionRequired.map((it) => {
                const d = draft[it.candidateId] || {};
                const tests = Array.isArray(it.selectedTests) ? it.selectedTests : [];
                const hasTally = tests.includes('Tally');
                const hasVoice = tests.includes('Voice');
                const hasExcel = tests.includes('Excel');

                const keyEa = `${it.candidateId}:EA`;
                const keyExcel = `${it.candidateId}:EXCEL`;

                const techResU = String(it.techResult || '').toUpperCase();
                const techContinued = techResU === 'FAIL' && isContinued_(it, 'TECHNICAL');
                const techDecisionPending = techResU === 'FAIL' && !techContinued;

                return (
                  <div key={it.candidateId} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                    <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 240 }}>
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
                          <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>
                            In-person: {it.inPersonMarks}/10
                          </span>
                          <span className="badge" style={{ 
                            background: it.techResult === 'PASS' ? '#22c55e' : it.techResult === 'FAIL' ? '#ef4444' : '#f59e0b', 
                            color: '#fff' 
                          }}>
                            {it.techResult ? String(it.techResult).toUpperCase() : 'PENDING'}
                          </span>
                          {techContinued ? (
                            <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Continued by HR</span>
                          ) : techDecisionPending ? (
                            <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>Decision Required</span>
                          ) : null}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <span className="small" style={{ fontWeight: 600 }}>Selected Tests: </span>
                          {tests.map((t) => (
                            <span key={t} className="badge" style={{ marginRight: 4 }}>{t}</span>
                          ))}
                          {tests.length === 0 && <span className="small" style={{ color: 'var(--gray-500)' }}>None</span>}
                        </div>
                        {it.updatedAt && (
                          <div className="small" style={{ marginTop: 6, color: 'var(--gray-500)' }}>
                            Last update: {fmtDateTime(it.updatedAt)}
                          </div>
                        )}
                        <div style={{ marginTop: 10 }}>
                          <ViewCvButton cvFileId={it.cvFileId} token={token} />
                        </div>
                        <SlaCountdown sla={it.sla} />
                      </div>

                      <div style={{ display: 'grid', gap: 12, minWidth: 300 }}>
                        {/* Marks Inputs */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {hasTally && (
                            <div>
                              <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Tally</label>
                              <input
                                style={{ width: 80 }}
                                value={d.tallyMarks ?? ''}
                                onChange={(e) => setField(it.candidateId, 'tallyMarks', e.target.value)}
                                placeholder="0-10"
                              />
                            </div>
                          )}
                          {hasVoice && (
                            <div>
                              <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Voice</label>
                              <input
                                style={{ width: 80 }}
                                value={d.voiceMarks ?? ''}
                                onChange={(e) => setField(it.candidateId, 'voiceMarks', e.target.value)}
                                placeholder="0-10"
                              />
                            </div>
                          )}
                          {hasExcel && canExcelUi && (
                            <div>
                              <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                Excel {!canExcelAction && '🔒'}
                              </label>
                              <input
                                style={{ width: 80, opacity: canExcelAction ? 1 : 0.5 }}
                                value={d.excelMarks ?? ''}
                                onChange={(e) => setField(it.candidateId, 'excelMarks', e.target.value)}
                                disabled={!canExcelAction}
                                placeholder="0-10"
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="small" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>
                            Test Review (Required)
                          </label>
                          <textarea
                            value={d.review ?? ''}
                            onChange={(e) => setField(it.candidateId, 'review', e.target.value)}
                            rows={2}
                            placeholder="Write review for tests"
                            style={{ width: '100%' }}
                          />
                        </div>

                        {techDecisionPending ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              className="button"
                              type="button"
                              onClick={() => {
                                setDecisionCtx({
                                  requirementId: it.requirementId,
                                  candidateId: it.candidateId,
                                  candidateName: it.candidateName,
                                  candidateNameFull: it.candidateNameFull,
                                  mobile: it.mobile,
                                  mobileFull: it.mobileFull,
                                  testType: 'TECHNICAL',
                                  stageTag: 'Technical Tests',
                                  failed: null,
                                  marks: { tallyMarks: it.tallyMarks, voiceMarks: it.voiceMarks, excelMarks: it.excelMarks },
                                });
                                setDecisionRemark('');
                              }}
                              disabled={!!busyKey}
                            >
                              Decide (Continue/Reject)
                            </button>
                          </div>
                        ) : null}

                        {/* Action Buttons */}
                        <div className="action-grid">
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => onSubmitEa(it)}
                            disabled={!canEaSubmit || !!busyKey}
                          >
                            {busyKey === keyEa ? <Spinner size={14} /> : null}
                            Submit EA Marks
                          </button>
                          {hasExcel && canExcelUi && (
                            <button
                              className="button"
                              type="button"
                              onClick={() => onSubmitExcel(it)}
                              disabled={!canExcelAction || !!busyKey}
                            >
                              {busyKey === keyExcel ? <Spinner size={14} /> : null}
                              Submit Excel
                            </button>
                          )}
                        </div>
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
            title="Pending Technical Tests"
            subtitle="Enter marks for Tally, Voice, and Excel tests"
            badge={pendingNonDecision.length}
            variant="card"
            defaultOpen={true}
          >
            {pendingNonDecision.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-text">No pending technical tests</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                {pendingNonDecision.map((it) => {
                  const d = draft[it.candidateId] || {};
                  const tests = Array.isArray(it.selectedTests) ? it.selectedTests : [];
                  const hasTally = tests.includes('Tally');
                  const hasVoice = tests.includes('Voice');
                  const hasExcel = tests.includes('Excel');

                  const keyEa = `${it.candidateId}:EA`;
                  const keyExcel = `${it.candidateId}:EXCEL`;

                  const techResU = String(it.techResult || '').toUpperCase();
                  const techContinued = techResU === 'FAIL' && isContinued_(it, 'TECHNICAL');
                  const techDecisionPending = techResU === 'FAIL' && !techContinued;

                  return (
                    <div key={it.candidateId} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                      <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 240 }}>
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
                            <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>
                              In-person: {it.inPersonMarks}/10
                            </span>
                            <span
                              className="badge"
                              style={{
                                background: it.techResult === 'PASS' ? '#22c55e' : it.techResult === 'FAIL' ? '#ef4444' : '#f59e0b',
                                color: '#fff',
                              }}
                            >
                              {it.techResult ? String(it.techResult).toUpperCase() : 'PENDING'}
                            </span>
                            {techContinued ? (
                              <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Continued by HR</span>
                            ) : techDecisionPending ? (
                              <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>Decision Required</span>
                            ) : null}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <span className="small" style={{ fontWeight: 600 }}>Selected Tests: </span>
                            {tests.map((t) => (
                              <span key={t} className="badge" style={{ marginRight: 4 }}>{t}</span>
                            ))}
                            {tests.length === 0 && <span className="small" style={{ color: 'var(--gray-500)' }}>None</span>}
                          </div>
                          {it.updatedAt && (
                            <div className="small" style={{ marginTop: 6, color: 'var(--gray-500)' }}>
                              Last update: {fmtDateTime(it.updatedAt)}
                            </div>
                          )}
                          <div style={{ marginTop: 10 }}>
                            <ViewCvButton cvFileId={it.cvFileId} token={token} />
                          </div>
                          <SlaCountdown sla={it.sla} />
                        </div>

                        <div style={{ display: 'grid', gap: 12, minWidth: 300 }}>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {hasTally && (
                              <div>
                                <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Tally</label>
                                <input
                                  style={{ width: 80 }}
                                  value={d.tallyMarks ?? ''}
                                  onChange={(e) => setField(it.candidateId, 'tallyMarks', e.target.value)}
                                  placeholder="0-10"
                                />
                              </div>
                            )}
                            {hasVoice && (
                              <div>
                                <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>Voice</label>
                                <input
                                  style={{ width: 80 }}
                                  value={d.voiceMarks ?? ''}
                                  onChange={(e) => setField(it.candidateId, 'voiceMarks', e.target.value)}
                                  placeholder="0-10"
                                />
                              </div>
                            )}
                            {hasExcel && canExcelUi && (
                              <div>
                                <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                  Excel {!canExcelAction && '🔒'}
                                </label>
                                <input
                                  style={{ width: 80, opacity: canExcelAction ? 1 : 0.5 }}
                                  value={d.excelMarks ?? ''}
                                  onChange={(e) => setField(it.candidateId, 'excelMarks', e.target.value)}
                                  disabled={!canExcelAction}
                                  placeholder="0-10"
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="small" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>
                              Test Review (Required)
                            </label>
                            <textarea
                              value={d.review ?? ''}
                              onChange={(e) => setField(it.candidateId, 'review', e.target.value)}
                              rows={2}
                              placeholder="Write review for tests"
                              style={{ width: '100%' }}
                            />
                          </div>

                          {techDecisionPending ? (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                className="button"
                                type="button"
                                onClick={() => {
                                  setDecisionCtx({
                                    requirementId: it.requirementId,
                                    candidateId: it.candidateId,
                                    candidateName: it.candidateName,
                                    candidateNameFull: it.candidateNameFull,
                                    mobile: it.mobile,
                                    mobileFull: it.mobileFull,
                                    testType: 'TECHNICAL',
                                    stageTag: 'Technical Tests',
                                    failed: null,
                                    marks: { tallyMarks: it.tallyMarks, voiceMarks: it.voiceMarks, excelMarks: it.excelMarks },
                                  });
                                  setDecisionRemark('');
                                }}
                                disabled={!!busyKey}
                              >
                                Decide (Continue/Reject)
                              </button>
                            </div>
                          ) : null}

                          <div className="action-grid">
                            <button
                              className="button primary"
                              type="button"
                              onClick={() => onSubmitEa(it)}
                              disabled={!canEaSubmit || !!busyKey}
                            >
                              {busyKey === keyEa ? <Spinner size={14} /> : null}
                              Submit EA Marks
                            </button>
                            {hasExcel && canExcelUi && (
                              <button
                                className="button"
                                type="button"
                                onClick={() => onSubmitExcel(it)}
                                disabled={!canExcelAction || !!busyKey}
                              >
                                {busyKey === keyExcel ? <Spinner size={14} /> : null}
                                Submit Excel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
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
