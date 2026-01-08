import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import {
  probationList,
  probationSet,
  probationDecide,
  roleChange,
} from '../api/candidates';
import { assignTraining, trainingClose, trainingList, trainingMarkComplete, trainingMasterList, updateTrainingStatus } from '../api/training';
import { LoadingOverlay, Spinner } from '../components/ui/Spinner';
import { Collapsible } from '../components/ui/Collapsible';
import { SlaCountdown } from '../components/ui/SlaCountdown';
import { HRTrainingDashboard } from '../components/training/HRTrainingDashboard';
import { TrainingList } from '../components/training/TrainingList';
import { openFile } from '../utils/files';
import { candidateDisplayName } from '../utils/pii';
import { useNowTick } from '../utils/useNowTick';

function fmtDateTime(value) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function humanCountdown(ms) {
  if (!Number.isFinite(ms)) return '-';
  const sign = ms < 0 ? '-' : '';
  const abs = Math.abs(ms);
  const totalSeconds = Math.floor(abs / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  parts.push(`${String(hours).padStart(2, '0')}h`);
  parts.push(`${String(minutes).padStart(2, '0')}m`);
  parts.push(`${String(seconds).padStart(2, '0')}s`);
  return `${sign}${parts.join(' ')}`;
}

export function ProbationPage() {
  const navigate = useNavigate();
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

  const portalAllowed = allowPortal_('PORTAL_HR_PROBATION', ['HR', 'EA', 'ADMIN']);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [busyKey, setBusyKey] = useState('');
  const [drafts, setDrafts] = useState({});
  const nowTick = useNowTick();

  const [trainingTemplates, setTrainingTemplates] = useState([]);
  const [trainingTemplatesLoading, setTrainingTemplatesLoading] = useState(false);
  const [trainingsByCandidate, setTrainingsByCandidate] = useState({});
  const [trainingsLoadingByCandidate, setTrainingsLoadingByCandidate] = useState({});
  const [trainingDrafts, setTrainingDrafts] = useState({});
  const [trainingStateByCandidate, setTrainingStateByCandidate] = useState({});

  const canRoleChange = allowAction_('ROLE_CHANGE', ['ADMIN', 'EA']);

  function canCompleteProbation_(candidateId) {
    const raw = trainingsByCandidate?.[candidateId];
    if (raw == null) return { ok: false, reason: 'Load trainings first' };
    const list = Array.isArray(raw) ? raw : [];
    if (!list.length) return { ok: false, reason: 'Training not assigned' };

    const open = list.reduce((acc, x) => {
      const s = String(x?.status || '').toUpperCase();
      if (s !== 'COMPLETED') return acc + 1;
      return acc;
    }, 0);
    if (open > 0) return { ok: false, reason: 'Training pending' };
    const st = trainingStateByCandidate?.[candidateId];
    if (!st?.closedAt) return { ok: false, reason: 'Close Training required' };
    return { ok: true, reason: '' };
  }

  async function loadTrainingTemplates() {
    if (!portalAllowed) return;
    if (!allowAction_('TRAINING_MASTER_LIST', ['HR', 'ADMIN'])) return;
    setTrainingTemplatesLoading(true);
    try {
      const res = await trainingMasterList(token);
      setTrainingTemplates(res.items ?? []);
    } catch (e) {
      toast.error(e?.message || 'Failed to load training templates');
      setTrainingTemplates([]);
    } finally {
      setTrainingTemplatesLoading(false);
    }
  }

  async function refresh() {
    if (!portalAllowed) return;
    if (!allowAction_('PROBATION_LIST', ['HR', 'EA', 'ADMIN'])) return;
    setLoading(true);
    try {
      const res = await probationList(token);
      const next = res.items || [];
      setItems(next);

      setTrainingStateByCandidate((prev) => {
        const copy = { ...prev };
        next.forEach((it) => {
          if (it?.candidateId && it?.trainingState) {
            copy[it.candidateId] = it.trainingState;
          }
        });
        return copy;
      });

      setDrafts((prev) => {
        const copy = { ...prev };
        next.forEach((it) => {
          if (!copy[it.candidateId]) {
            copy[it.candidateId] = {
              probationDays: 90,
              rejectRemark: '',
              newJobRole: it.jobRole || '',
              roleChangeRemark: '',
            };
          } else {
            copy[it.candidateId] = {
              probationDays: copy[it.candidateId].probationDays ?? 90,
              rejectRemark: copy[it.candidateId].rejectRemark ?? '',
              newJobRole: copy[it.candidateId].newJobRole ?? (it.jobRole || ''),
              roleChangeRemark: copy[it.candidateId].roleChangeRemark ?? '',
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

  useEffect(() => {
    loadTrainingTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalAllowed]);

  const total = useMemo(() => items.length, [items]);

  async function onProbationSet(it) {
    if (!allowAction_('PROBATION_SET', ['HR', 'EA', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const d = drafts[it.candidateId] || {};
    const probationDays = Number(d.probationDays || 0);
    if (!Number.isFinite(probationDays) || probationDays <= 0) {
      toast.error('Enter probation days');
      return;
    }

    const key = `${it.candidateId}:PROBATION_SET`;
    setBusyKey(key);
    try {
      await probationSet(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        probationDays,
      });
      toast.success('Probation set');
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onProbationReject(it) {
    if (!allowAction_('PROBATION_DECIDE', ['HR', 'EA', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const d = drafts[it.candidateId] || {};
    const remark = String(d.rejectRemark || '').trim();
    if (!remark) {
      toast.error('Remark is required');
      return;
    }

    const key = `${it.candidateId}:PROBATION_REJECT`;
    setBusyKey(key);
    try {
      await probationDecide(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        decision: 'REJECT',
        remark,
      });
      toast.success('Rejected');
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onProbationComplete(it) {
    if (!allowAction_('PROBATION_DECIDE', ['HR', 'EA', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${it.candidateId}:PROBATION_COMPLETE`;
    setBusyKey(key);
    try {
      const res = await probationDecide(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        decision: 'COMPLETE',
        remark: '',
      });
      toast.success('Probation completed');
      if (res?.employeeId) {
        navigate(`/employee/${encodeURIComponent(res.employeeId)}`);
        return;
      }
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onRoleChange(it) {
    if (!allowAction_('ROLE_CHANGE', ['ADMIN', 'EA'])) {
      toast.error('Not allowed');
      return;
    }
    const d = drafts[it.candidateId] || {};
    const jobRole = String(d.newJobRole || '').trim();
    const remark = String(d.roleChangeRemark || '').trim();
    if (!jobRole) {
      toast.error('Enter new job role');
      return;
    }

    const key = `${it.candidateId}:ROLE_CHANGE`;
    setBusyKey(key);
    try {
      await roleChange(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        jobRole,
        remark,
      });
      toast.success('Role updated (probation reset)');
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  function viewFile(fileId) {
    if (!fileId) return;
    const ok = openFile(fileId, token);
    if (!ok) toast.error('Unable to open file');
  }

  async function loadCandidateTrainings(candidateId) {
    if (!allowAction_('TRAINING_LIST', ['HR', 'ADMIN', 'EA'])) {
      toast.error('Not allowed');
      return;
    }
    setTrainingsLoadingByCandidate((p) => ({ ...p, [candidateId]: true }));
    try {
      const res = await trainingList(token, { candidateId });
      setTrainingsByCandidate((p) => ({ ...p, [candidateId]: res.items ?? [] }));
      if (res?.state) {
        setTrainingStateByCandidate((p) => ({ ...p, [candidateId]: res.state }));
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to load trainings');
      setTrainingsByCandidate((p) => ({ ...p, [candidateId]: [] }));
    } finally {
      setTrainingsLoadingByCandidate((p) => ({ ...p, [candidateId]: false }));
    }
  }

  async function onAssignTraining(it) {
    if (!allowAction_('TRAINING_ASSIGN', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }

    const d = trainingDrafts[it.candidateId] || {};
    const trainingId = String(d.training_id || '').trim();
    const due = String(d.due_date || '').trim();
    if (!trainingId) {
      toast.error('Select training');
      return;
    }
    if (!due) {
      toast.error('Select due date');
      return;
    }

    const dueIso = new Date(due + 'T23:59:59').toISOString();

    const key = `${it.candidateId}:TRAINING_ASSIGN`;
    setBusyKey(key);
    try {
      await assignTraining(token, {
        candidate_id: it.candidateId,
        training_id: trainingId,
        due_date: dueIso,
        video_link: String(d.video_link || '').trim(),
        description: String(d.description || '').trim(),
        documentsLines: String(d.documentsLines || ''),
      });
      toast.success('Training assigned');
      setTrainingDrafts((p) => ({
        ...p,
        [it.candidateId]: { ...p[it.candidateId], due_date: '', video_link: '', description: '', documentsLines: '' },
      }));
      await loadCandidateTrainings(it.candidateId);
    } catch (e) {
      toast.error(e?.message || 'Assign failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onStartTraining(candidateId, item) {
    if (!allowAction_('TRAINING_STATUS_UPDATE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${candidateId}:TRAINING_START:${item.assigned_id}`;
    setBusyKey(key);
    try {
      await updateTrainingStatus(token, {
        candidate_id: candidateId,
        assigned_id: item.assigned_id,
        op: 'START',
        remarks: '',
      });
      toast.success('Marked In-Progress');
      await loadCandidateTrainings(candidateId);
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onCompleteTraining(candidateId, item) {
    if (!allowAction_('TRAINING_STATUS_UPDATE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${candidateId}:TRAINING_COMPLETE:${item.assigned_id}`;
    setBusyKey(key);
    try {
      await updateTrainingStatus(token, {
        candidate_id: candidateId,
        assigned_id: item.assigned_id,
        op: 'COMPLETE',
        remarks: '',
      });
      toast.success('Completed');
      await loadCandidateTrainings(candidateId);
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onTrainingMarkComplete(it) {
    if (!allowAction_('TRAINING_MARK_COMPLETE', ['HR', 'EA', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${it.candidateId}:TRAINING_MARK_COMPLETE`;
    setBusyKey(key);
    try {
      const res = await trainingMarkComplete(token, { requirementId: it.requirementId, candidateId: it.candidateId });
      setTrainingStateByCandidate((p) => ({ ...p, [it.candidateId]: res }));
      toast.success('Training marked complete');
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onTrainingClose(it) {
    if (!allowAction_('TRAINING_CLOSE', ['HR', 'EA', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${it.candidateId}:TRAINING_CLOSE`;
    setBusyKey(key);
    try {
      const res = await trainingClose(token, { requirementId: it.requirementId, candidateId: it.candidateId });
      if (res?.closed) {
        setTrainingStateByCandidate((p) => ({ ...p, [it.candidateId]: res }));
        toast.success('Training closed');
        return;
      }
      const pending = res?.pending ?? [];
      const names = Array.isArray(pending) ? pending.map((x) => x.training_name || x.training_name || x.training_id).filter(Boolean) : [];
      toast.error(names.length ? `Pending trainings: ${names.join(', ')}` : 'Training pending');
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
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have access to Probation portal.</div>
        </div>
      ) : null}
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">Probation</h1>
        <p className="page-subtitle">Manage employee probation period and decisions</p>
      </div>

      {portalAllowed && allowAction_('TRAINING_DASHBOARD', ['HR', 'ADMIN']) ? (
        <div style={{ marginBottom: 16 }}>
          <HRTrainingDashboard token={token} scope="PROBATION" />
        </div>
      ) : null}

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
          title="Probation Candidates"
          subtitle="Set probation, make decisions, or change roles"
          badge={total}
          variant="card"
          defaultOpen={true}
        >
          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-text">No candidates in Probation flow</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {items.map((it) => {
                const st = String(it.status || '').toUpperCase();
                const isJoined = st === 'JOINED';
                const isProbation = st === 'PROBATION';

                const endsAt = it.probationEndsAt ? new Date(it.probationEndsAt) : null;
                const msLeft = endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt.getTime() - nowTick : null;

                const d = drafts[it.candidateId] || {};

                const tDraft = trainingDrafts[it.candidateId] || {};
                const tItems = trainingsByCandidate[it.candidateId] || [];
                const tLoading = !!trainingsLoadingByCandidate[it.candidateId];
                const canAssignTraining = allowAction_('TRAINING_ASSIGN', ['HR', 'ADMIN']);
                const canListTraining = allowAction_('TRAINING_LIST', ['HR', 'ADMIN', 'EA']);
                const canUpdateTraining = allowAction_('TRAINING_STATUS_UPDATE', ['HR', 'ADMIN']);

                const tCounts = tItems.reduce(
                  (acc, x) => {
                    const s = String(x?.status || '').toUpperCase();
                    acc.TOTAL += 1;
                    if (s === 'COMPLETED') acc.COMPLETED += 1;
                    else if (s === 'IN_PROGRESS') acc.IN_PROGRESS += 1;
                    else if (s === 'OVERDUE') acc.OVERDUE += 1;
                    else acc.PENDING += 1;
                    return acc;
                  },
                  { TOTAL: 0, PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0 }
                );
                const trState = trainingStateByCandidate?.[it.candidateId] || null;
                const trainingReady = !!tCounts.TOTAL && (tCounts.PENDING + tCounts.IN_PROGRESS + tCounts.OVERDUE) === 0;

                return (
                  <div key={`${it.requirementId}:${it.candidateId}`} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                    {/* Header */}
                    <div className="row" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>
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
                          <span className="badge">Req: {it.requirementId}</span>
                          <span className="badge" style={{ 
                            background: isProbation ? '#f59e0b' : isJoined ? '#22c55e' : 'var(--primary)', 
                            color: '#fff' 
                          }}>
                            {it.status}
                          </span>
                        </div>
                        <SlaCountdown sla={it.sla} nowMs={nowTick} />
                      </div>

                      {/* Countdown */}
                      <div style={{ textAlign: 'right' }}>
                        <div className="small" style={{ color: 'var(--gray-500)' }}>Joined At</div>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginTop: 2 }}>
                          {fmtDateTime(it.joinedAt)}
                        </div>
                        {isProbation && msLeft != null && (
                          <div style={{ marginTop: 8 }}>
                            <span className="badge" style={{ 
                              background: msLeft < 0 ? '#ef4444' : msLeft < 7 * 24 * 60 * 60 * 1000 ? '#f59e0b' : '#22c55e', 
                              color: '#fff', 
                              fontFamily: 'monospace' 
                            }}>
                              ⏱ {humanCountdown(msLeft)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isProbation && (
                      <div style={{ marginBottom: 16, padding: '10px 12px', background: 'var(--gray-100)', borderRadius: 'var(--radius)', fontSize: '13px' }}>
                        <strong>Probation Period:</strong> {fmtDateTime(it.probationStartAt)} → {fmtDateTime(it.probationEndsAt)}
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                      <button className="button" type="button" onClick={() => viewFile(it.cvFileId)} disabled={!it.cvFileId}>
                        📄 View CV
                      </button>
                      {it.employeeId && (
                        <button
                          className="button"
                          type="button"
                          onClick={() => navigate(`/employee/${encodeURIComponent(it.employeeId)}`)}
                        >
                          👤 View Employee
                        </button>
                      )}
                    </div>

                    {/* Set Probation (for JOINED status) */}
                    {isJoined && (
                      <div style={{ padding: '12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', marginBottom: 12 }}>
                        <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>📅 Set Probation</div>
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div style={{ flex: 1, minWidth: 140 }}>
                            <label className="small" style={{ display: 'block', marginBottom: 4 }}>Probation Days</label>
                            <input
                              value={d.probationDays ?? ''}
                              onChange={(e) =>
                                setDrafts((p) => ({
                                  ...p,
                                  [it.candidateId]: { ...p[it.candidateId], probationDays: e.target.value },
                                }))
                              }
                              placeholder="90"
                              style={{ width: '100%' }}
                            />
                          </div>
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => onProbationSet(it)}
                            disabled={!!busyKey || !allowAction_('PROBATION_SET', ['HR', 'EA', 'ADMIN'])}
                          >
                            {busyKey === `${it.candidateId}:PROBATION_SET` ? <Spinner size={14} /> : null}
                            Set Probation
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Training Closure (for PROBATION status) */}
                    {isProbation && (
                      <div style={{ padding: '12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', marginBottom: 12 }}>
                        <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Training Closure</div>
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            className="button"
                            type="button"
                            onClick={() => onTrainingMarkComplete(it)}
                            disabled={!!busyKey || !allowAction_('TRAINING_MARK_COMPLETE', ['HR', 'EA', 'ADMIN'])}
                          >
                            {busyKey === `${it.candidateId}:TRAINING_MARK_COMPLETE` ? <Spinner size={14} /> : null}
                            Mark Training Complete
                          </button>
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => onTrainingClose(it)}
                            disabled={!!busyKey || !allowAction_('TRAINING_CLOSE', ['HR', 'EA', 'ADMIN']) || !trState?.markedCompleteAt}
                          >
                            {busyKey === `${it.candidateId}:TRAINING_CLOSE` ? <Spinner size={14} /> : null}
                            Close Training
                          </button>
                          {trState?.closedAt ? (
                            <span className="badge" style={{ background: '#22c55e', color: '#fff' }}>Closed</span>
                          ) : trState?.markedCompleteAt ? (
                            <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Marked Complete</span>
                          ) : (
                            <span className="badge">Not Closed</span>
                          )}
                        </div>
                        {!trainingReady ? (
                          <div className="small" style={{ marginTop: 8, color: 'var(--gray-600)' }}>Finish all trainings to enable closure.</div>
                        ) : null}
                        {trState?.markedCompleteAt ? (
                          <div className="small" style={{ marginTop: 8, color: 'var(--gray-600)' }}>Marked: {fmtDateTime(trState.markedCompleteAt)}</div>
                        ) : null}
                        {trState?.closedAt ? (
                          <div className="small" style={{ marginTop: 4, color: 'var(--gray-600)' }}>Closed: {fmtDateTime(trState.closedAt)}</div>
                        ) : null}
                      </div>
                    )}

                    {/* Decision (for PROBATION status) */}
                    {isProbation && (
                      <div style={{ padding: '12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', marginBottom: 12 }}>
                        <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>⚖️ Decision</div>
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <label className="small" style={{ display: 'block', marginBottom: 4 }}>Reject Remark</label>
                            <input
                              value={d.rejectRemark ?? ''}
                              onChange={(e) =>
                                setDrafts((p) => ({
                                  ...p,
                                  [it.candidateId]: { ...p[it.candidateId], rejectRemark: e.target.value },
                                }))
                              }
                              placeholder="Reason for rejection"
                              style={{ width: '100%' }}
                            />
                          </div>
                          <button
                            className="button danger"
                            type="button"
                            onClick={() => onProbationReject(it)}
                            disabled={!!busyKey || !allowAction_('PROBATION_DECIDE', ['HR', 'EA', 'ADMIN'])}
                          >
                            {busyKey === `${it.candidateId}:PROBATION_REJECT` ? <Spinner size={14} /> : null}
                            Reject
                          </button>
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => onProbationComplete(it)}
                            disabled={!!busyKey || !allowAction_('PROBATION_DECIDE', ['HR', 'EA', 'ADMIN']) || !canCompleteProbation_(it.candidateId).ok}
                          >
                            {busyKey === `${it.candidateId}:PROBATION_COMPLETE` ? <Spinner size={14} /> : null}
                            Complete
                          </button>
                        </div>
                      </div>
                    )}
                          {!canCompleteProbation_(it.candidateId).ok ? (
                            <div className="small" style={{ marginTop: 6, color: 'var(--gray-600)' }}>
                              Probation complete disabled: {canCompleteProbation_(it.candidateId).reason}.
                            </div>
                          ) : null}

                    {/* Role Change (Admin/EA only) */}
                    {canRoleChange && (
                      <div style={{ padding: '12px', background: '#fef3c7', borderRadius: 'var(--radius)' }}>
                        <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>🔄 Role Change</div>
                        <div className="small" style={{ marginBottom: 8, color: 'var(--gray-600)' }}>
                          Updates role and restarts probation
                        </div>
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div style={{ minWidth: 160 }}>
                            <label className="small" style={{ display: 'block', marginBottom: 4 }}>New Job Role</label>
                            <input
                              value={d.newJobRole ?? ''}
                              onChange={(e) =>
                                setDrafts((p) => ({
                                  ...p,
                                  [it.candidateId]: { ...p[it.candidateId], newJobRole: e.target.value },
                                }))
                              }
                              placeholder="EA / HR / ..."
                              style={{ width: '100%' }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 160 }}>
                            <label className="small" style={{ display: 'block', marginBottom: 4 }}>Remark</label>
                            <input
                              value={d.roleChangeRemark ?? ''}
                              onChange={(e) =>
                                setDrafts((p) => ({
                                  ...p,
                                  [it.candidateId]: { ...p[it.candidateId], roleChangeRemark: e.target.value },
                                }))
                              }
                              placeholder="Optional"
                              style={{ width: '100%' }}
                            />
                          </div>
                          <button
                            className="button"
                            type="button"
                            onClick={() => onRoleChange(it)}
                            disabled={!!busyKey || !allowAction_('ROLE_CHANGE', ['ADMIN', 'EA'])}
                          >
                            {busyKey === `${it.candidateId}:ROLE_CHANGE` ? <Spinner size={14} /> : null}
                            Change Role
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Trainings */}
                    <div style={{ height: 12 }} />
                    <div style={{ padding: '12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
                      <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div>
                          <div className="small" style={{ fontWeight: 800 }}>📚 Trainings</div>
                          <div className="small" style={{ color: 'var(--gray-600)' }}>Assign trainings and track status</div>
                        </div>
                        {tItems.length ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span className="badge">Total: {tCounts.TOTAL}</span>
                            <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Pending: {tCounts.PENDING}</span>
                            <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>In-Progress: {tCounts.IN_PROGRESS}</span>
                            <span className="badge" style={{ background: '#22c55e', color: '#fff' }}>Completed: {tCounts.COMPLETED}</span>
                            <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>Overdue: {tCounts.OVERDUE}</span>
                          </div>
                        ) : null}
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            className="button"
                            type="button"
                            onClick={() => loadCandidateTrainings(it.candidateId)}
                            disabled={tLoading || !canListTraining}
                          >
                            {tLoading ? <Spinner size={14} /> : null}
                            {tItems.length ? 'Refresh Trainings' : 'Load Trainings'}
                          </button>
                          {tItems.length ? (
                            <button
                              className="button"
                              type="button"
                              onClick={async () => {
                                const lines = [
                                  `Candidate: ${candidateDisplayName(it) || it.candidateId}${candidateDisplayName(it) && it.candidateId ? ` (${it.candidateId})` : ''}`,
                                  `Training Summary: Total=${tCounts.TOTAL}, Completed=${tCounts.COMPLETED}, Pending=${tCounts.PENDING}, In-Progress=${tCounts.IN_PROGRESS}, Overdue=${tCounts.OVERDUE}`,
                                ];
                                try {
                                  await navigator.clipboard.writeText(lines.join('\n'));
                                  toast.success('Summary copied');
                                } catch {
                                  toast.error('Copy failed');
                                }
                              }}
                              disabled={tLoading}
                            >
                              Copy Summary
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {canAssignTraining ? (
                        <div style={{ marginTop: 12 }}>
                          <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>Assign Training</div>
                          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div style={{ minWidth: 220 }}>
                              <label className="small" style={{ display: 'block', marginBottom: 4 }}>Training</label>
                              <select
                                value={tDraft.training_id || ''}
                                onChange={(e) =>
                                  setTrainingDrafts((p) => ({
                                    ...p,
                                    [it.candidateId]: { ...p[it.candidateId], training_id: e.target.value },
                                  }))
                                }
                                disabled={trainingTemplatesLoading}
                                style={{ width: '100%' }}
                              >
                                <option value="">Select…</option>
                                {trainingTemplates.map((t) => (
                                  <option key={t.training_id} value={t.training_id}>
                                    {t.name} ({t.department})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div style={{ minWidth: 160 }}>
                              <label className="small" style={{ display: 'block', marginBottom: 4 }}>Due Date</label>
                              <input
                                type="date"
                                value={tDraft.due_date || ''}
                                onChange={(e) =>
                                  setTrainingDrafts((p) => ({
                                    ...p,
                                    [it.candidateId]: { ...p[it.candidateId], due_date: e.target.value },
                                  }))
                                }
                              />
                            </div>
                            <button
                              className="button primary"
                              type="button"
                              onClick={() => onAssignTraining(it)}
                              disabled={!!busyKey || !canAssignTraining}
                            >
                              {busyKey === `${it.candidateId}:TRAINING_ASSIGN` ? <Spinner size={14} /> : null}
                              Assign
                            </button>
                          </div>

                          <div style={{ height: 10 }} />
                          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 240 }}>
                              <label className="small" style={{ display: 'block', marginBottom: 4 }}>Video Link (optional)</label>
                              <input
                                value={tDraft.video_link || ''}
                                onChange={(e) =>
                                  setTrainingDrafts((p) => ({
                                    ...p,
                                    [it.candidateId]: { ...p[it.candidateId], video_link: e.target.value },
                                  }))
                                }
                                placeholder="If blank, template link will be used"
                                style={{ width: '100%' }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 240 }}>
                              <label className="small" style={{ display: 'block', marginBottom: 4 }}>Description (optional)</label>
                              <input
                                value={tDraft.description || ''}
                                onChange={(e) =>
                                  setTrainingDrafts((p) => ({
                                    ...p,
                                    [it.candidateId]: { ...p[it.candidateId], description: e.target.value },
                                  }))
                                }
                                placeholder="If blank, template description will be used"
                                style={{ width: '100%' }}
                              />
                            </div>
                          </div>

                          <div style={{ height: 10 }} />
                          <div>
                            <label className="small" style={{ display: 'block', marginBottom: 4 }}>Documents (one URL or Drive fileId per line, optional)</label>
                            <textarea
                              value={tDraft.documentsLines || ''}
                              onChange={(e) =>
                                setTrainingDrafts((p) => ({
                                  ...p,
                                  [it.candidateId]: { ...p[it.candidateId], documentsLines: e.target.value },
                                }))
                              }
                              rows={2}
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                      ) : null}

                      <div style={{ height: 12 }} />
                      <TrainingList
                        items={tItems}
                        token={token}
                        loading={tLoading}
                        canUpdate={canUpdateTraining && !busyKey}
                        onStart={(item) => onStartTraining(it.candidateId, item)}
                        onComplete={(item) => onCompleteTraining(it.candidateId, item)}
                      />
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
