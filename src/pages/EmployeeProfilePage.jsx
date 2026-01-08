import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { employeeGet } from '../api/candidates';
import { trainingList, updateTrainingStatus } from '../api/training';
import { TrainingList } from '../components/training/TrainingList';
import { Spinner } from '../components/ui/Spinner';
import { openFile } from '../utils/files';
import { safeActorLabel } from '../utils/pii';

function fmtDateTime(value) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function EmployeeProfilePage() {
  const { employeeId } = useParams();
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

  const portalAllowed = allowPortal_('PORTAL_EMPLOYEE_PROFILE', ['EA', 'HR', 'OWNER', 'ADMIN']);
  const canLoad = portalAllowed && allowAction_('EMPLOYEE_GET', ['EA', 'HR', 'OWNER', 'ADMIN']);

  const [loading, setLoading] = useState(false);
  const [emp, setEmp] = useState(null);

  const [trainingsLoading, setTrainingsLoading] = useState(false);
  const [trainings, setTrainings] = useState([]);

  async function refresh() {
    if (!employeeId) return;
    if (!portalAllowed) return;
    if (!allowAction_('EMPLOYEE_GET', ['EA', 'HR', 'OWNER', 'ADMIN'])) return;
    setLoading(true);
    try {
      const res = await employeeGet(token, { employeeId });
      setEmp(res);
      if (res?.candidateId && allowAction_('TRAINING_LIST', ['ADMIN', 'EA', 'HR', 'OWNER'])) {
        setTrainingsLoading(true);
        try {
          const t = await trainingList(token, { candidateId: res.candidateId });
          setTrainings(t.items ?? []);
        } catch (e2) {
          setTrainings([]);
        } finally {
          setTrainingsLoading(false);
        }
      } else {
        setTrainings([]);
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to load');
      setEmp(null);
      setTrainings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, portalAllowed]);

  function viewFile(fileId) {
    if (!fileId) return;
    const ok = openFile(fileId, token);
    if (!ok) toast.error('Unable to open file');
  }

  return (
    <AppLayout>
      {!portalAllowed ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Not allowed</div>
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have access to Employee Profile portal.</div>
        </div>
      ) : null}

      <div className="card">
        <div className="row" style={{ alignItems: 'center' }}>
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Employee Profile</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="button" type="button" onClick={refresh} disabled={loading || !canLoad}>
              Refresh
            </button>
          </div>
        </div>

        <div style={{ height: 10 }} />
        <div className="small">{loading ? 'Loading…' : employeeId}</div>

        <div style={{ height: 12 }} />
        {!emp && !loading ? (
          <div className="small">Employee not found.</div>
        ) : emp ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <div className="card" style={{ background: '#fafafa' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{emp.employeeName || emp.employeeId}</div>
              <div className="small" style={{ marginTop: 4 }}>
                EmployeeId: <b>{emp.employeeId}</b>
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                RequirementId: <b>{emp.requirementId}</b> {emp.jobTitle ? `• ${emp.jobTitle}` : ''}
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                Role: {emp.jobRole || '-'} • Source: {emp.source || '-'}
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                Joined: {fmtDateTime(emp.joinedAt)}
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                Probation: {fmtDateTime(emp.probationStartAt)} → {fmtDateTime(emp.probationEndsAt)}
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                Created: {fmtDateTime(emp.createdAt)} • By: {safeActorLabel(emp.createdBy) || '-'}
              </div>

              <div style={{ height: 10 }} />
              <button className="button" type="button" onClick={() => viewFile(emp.cvFileId)} disabled={!emp.cvFileId}>
                View CV
              </button>
            </div>

            <div className="card" style={{ background: '#fafafa' }}>
              <div className="row" style={{ alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>Trainings</div>
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    className="button"
                    type="button"
                    onClick={refresh}
                    disabled={loading || trainingsLoading}
                  >
                    {(loading || trainingsLoading) ? <Spinner size={14} /> : null}
                    Refresh
                  </button>
                </div>
              </div>

              <div style={{ height: 10 }} />
              {trainings.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                  {(() => {
                    const counts = trainings.reduce(
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

                    return (
                      <>
                        <span className="badge">Total: {counts.TOTAL}</span>
                        <span className="badge" style={{ background: '#f59e0b', color: '#fff' }}>Pending: {counts.PENDING}</span>
                        <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>In-Progress: {counts.IN_PROGRESS}</span>
                        <span className="badge" style={{ background: '#22c55e', color: '#fff' }}>Completed: {counts.COMPLETED}</span>
                        <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>Overdue: {counts.OVERDUE}</span>
                        <button
                          className="button"
                          type="button"
                          onClick={async () => {
                            const lines = [
                              `Employee: ${emp.employeeName || emp.employeeId}`,
                              `Candidate: ${emp.candidateId || ''}`,
                              `Training Summary: Total=${counts.TOTAL}, Completed=${counts.COMPLETED}, Pending=${counts.PENDING}, In-Progress=${counts.IN_PROGRESS}, Overdue=${counts.OVERDUE}`,
                            ];
                            try {
                              await navigator.clipboard.writeText(lines.join('\n'));
                              toast.success('Summary copied');
                            } catch {
                              toast.error('Copy failed');
                            }
                          }}
                          disabled={trainingsLoading}
                        >
                          Copy Summary
                        </button>
                      </>
                    );
                  })()}
                </div>
              ) : null}
              <TrainingList
                items={trainings}
                token={token}
                loading={trainingsLoading}
                canUpdate={allowAction_('TRAINING_STATUS_UPDATE', ['ADMIN', 'HR'])}
                onStart={async (item) => {
                  try {
                    await updateTrainingStatus(token, {
                      candidate_id: emp.candidateId,
                      assigned_id: item.assigned_id,
                      op: 'START',
                      remarks: '',
                    });
                    toast.success('Marked In-Progress');
                    const t = await trainingList(token, { candidateId: emp.candidateId });
                    setTrainings(t.items ?? []);
                  } catch (e3) {
                    toast.error(e3?.message || 'Failed');
                  }
                }}
                onComplete={async (item) => {
                  try {
                    await updateTrainingStatus(token, {
                      candidate_id: emp.candidateId,
                      assigned_id: item.assigned_id,
                      op: 'COMPLETE',
                      remarks: '',
                    });
                    toast.success('Completed');
                    const t = await trainingList(token, { candidateId: emp.candidateId });
                    setTrainings(t.items ?? []);
                  } catch (e4) {
                    toast.error(e4?.message || 'Failed');
                  }
                }}
              />
            </div>

            <div className="card" style={{ background: '#fafafa' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Journey Timeline</div>
              {Array.isArray(emp.timeline) && emp.timeline.length ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {emp.timeline.map((t, i) => (
                    <div key={`${t.at || 'at'}:${i}`} className="card" style={{ background: '#fff' }}>
                      <div className="small">
                        <b>{fmtDateTime(t.at)}</b> • {t.stageTag || t.action || t.source || '-'}
                      </div>
                      <div className="small" style={{ marginTop: 4 }}>
                        {t.fromState || t.toState ? (
                          <span>
                            {t.fromState ? String(t.fromState) : ''}
                            {t.fromState || t.toState ? ' → ' : ''}
                            {t.toState ? String(t.toState) : ''}
                          </span>
                        ) : null}
                        {t.remark ? ` • ${t.remark}` : ''}
                      </div>
                      <div className="small" style={{ marginTop: 4, opacity: 0.8 }}>
                        {t.actorRole ? `${t.actorRole}` : ''}
                        {t.actorUserId ? ` (${t.actorUserId})` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="small">No timeline entries.</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
