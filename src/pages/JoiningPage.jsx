import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import {
  joiningList,
  joiningSetDate,
  docsUpload,
  docsComplete,
  markJoin,
} from '../api/candidates';
import { LoadingOverlay, Spinner } from '../components/ui/Spinner';
import { Collapsible } from '../components/ui/Collapsible';
import { validateScheduleDateTimeLocal } from '../utils/scheduling';
import { openFile } from '../utils/files';
import { ViewCvButton } from '../components/ui/ViewCvButton';
import { candidateDisplayName } from '../utils/pii';
import { SlaCountdown } from '../components/ui/SlaCountdown';
import { useNowTick } from '../utils/useNowTick';
import { formatDueAt, formatDurationMs, toMs } from '../utils/sla';

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

function JoinDateCountdown({ joiningAt }) {
  const nowMs = useNowTick();
  const deadlineMs = toMs(joiningAt);

  if (deadlineMs == null) {
    return (
      <div style={{ textAlign: 'right' }}>
        <div className="small" style={{ color: 'var(--gray-500)' }}>Joining Date</div>
        <div style={{ fontWeight: 700, fontSize: '15px', marginTop: 2 }}>Not set</div>
      </div>
    );
  }

  const remainingMs = deadlineMs - nowMs;
  const isOverdue = remainingMs <= 0;
  const text = isOverdue ? `OVERDUE by ${formatDurationMs(-remainingMs)}` : `${formatDurationMs(remainingMs)} left`;

  return (
    <div style={{ textAlign: 'right' }}>
      <div className="small" style={{ color: 'var(--gray-500)' }}>Joining Date</div>
      <div style={{ fontWeight: 700, fontSize: '15px', marginTop: 2 }}>{formatDueAt(deadlineMs) || '-'}</div>
      <div style={{ marginTop: 4 }}>
        <span className="badge" style={{ background: isOverdue ? '#ef4444' : '#22c55e', color: '#fff', fontFamily: 'monospace' }}>
          {text}
        </span>
      </div>
    </div>
  );
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || '');
      // data:<mime>;base64,<...>
      const comma = res.indexOf(',');
      if (comma === -1) {
        reject(new Error('Invalid file encoding'));
        return;
      }
      resolve(res.slice(comma + 1));
    };
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsDataURL(file);
  });
}

export function JoiningPage() {
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

  const portalAllowed = allowPortal_('PORTAL_HR_JOINING', ['HR', 'ADMIN']);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [busyKey, setBusyKey] = useState('');
  const [drafts, setDrafts] = useState({});
  const [selectedFiles, setSelectedFiles] = useState({});

  async function refresh() {
    if (!portalAllowed) return;
    if (!allowAction_('JOINING_LIST', ['HR', 'ADMIN'])) return;
    setLoading(true);
    try {
      const res = await joiningList(token);
      const next = res.items || [];
      setItems(next);

      setDrafts((prev) => {
        const copy = { ...prev };
        next.forEach((it) => {
          if (!copy[it.candidateId]) {
            copy[it.candidateId] = {
              joiningAt: toDateTimeLocalValue(it.joiningAt),
              remark: '',
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

  async function onSetJoiningDate(it) {
    if (!allowAction_('JOINING_SET_DATE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const d = drafts[it.candidateId] || {};
    const raw = String(d.joiningAt || '').trim();
    if (!raw) {
      toast.error('Select joining date/time');
      return;
    }

    const v = validateScheduleDateTimeLocal(raw);
    if (!v.ok) {
      toast.error(v.message);
      return;
    }
    const dt = v.date;

    const key = `${it.candidateId}:SET_DATE`;
    setBusyKey(key);
    try {
      await joiningSetDate(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        joiningAt: dt.toISOString(),
      });
      toast.success('Joining date set');
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onDocsUpload(it) {
    if (!allowAction_('DOCS_UPLOAD', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const files = selectedFiles[it.candidateId] || [];
    if (!files.length) {
      toast.error('Select documents first');
      return;
    }

    const key = `${it.candidateId}:DOCS_UPLOAD`;
    setBusyKey(key);
    try {
      const docs = [];
      for (let i = 0; i < files.length; i += 1) {
        const f = files[i];
        // eslint-disable-next-line no-await-in-loop
        const base64 = await fileToBase64(f);
        docs.push({
          filename: f.name,
          mimeType: f.type || 'application/octet-stream',
          base64,
          docType: '',
        });
      }

      await docsUpload(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        docs,
      });

      toast.success('Docs uploaded');
      setSelectedFiles((p) => ({ ...p, [it.candidateId]: [] }));
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onDocsComplete(it) {
    if (!allowAction_('DOCS_COMPLETE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${it.candidateId}:DOCS_COMPLETE`;
    setBusyKey(key);
    try {
      await docsComplete(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
      });
      toast.success('Docs marked complete');
      await refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed');
    } finally {
      setBusyKey('');
    }
  }

  async function onMarkJoin(it) {
    if (!allowAction_('MARK_JOIN', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${it.candidateId}:MARK_JOIN`;
    setBusyKey(key);
    try {
      await markJoin(token, {
        requirementId: it.requirementId,
        candidateId: it.candidateId,
        remark: '',
      });
      toast.success('Marked joined');
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

  return (
    <AppLayout>
      {!portalAllowed ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Not allowed</div>
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have access to Joining portal.</div>
        </div>
      ) : null}
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">Joining</h1>
        <p className="page-subtitle">Manage candidate joining process and documentation</p>
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
          title="Joining Candidates"
          subtitle="Set joining date, upload docs, and mark joined"
          badge={total}
          variant="card"
          defaultOpen={true}
        >
          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎉</div>
              <div className="empty-state-text">No candidates in Joining</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {items.map((it) => {
                const st = String(it.status || '').toUpperCase();
                const isJoining = st === 'JOINING';
                const docsDone = Boolean(it.docsCompleteAt);
                const hasDocs = Array.isArray(it.docs) && it.docs.length > 0;

                const d = drafts[it.candidateId] || { joiningAt: '', remark: '' };
                const files = selectedFiles[it.candidateId] || [];

                return (
                  <div key={it.candidateId} className="card" style={{ background: '#fff', border: '1px solid var(--gray-200)' }}>
                    <div style={{ display: 'grid', gap: 16 }}>
                      {/* Header */}
                      <div className="row" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
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
                            <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>{st}</span>
                            <ViewCvButton cvFileId={it.cvFileId} token={token} />
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <SlaCountdown sla={it.sla} />
                          </div>
                        </div>

                        {/* Countdown */}
                        <JoinDateCountdown joiningAt={it.joiningAt} />
                      </div>

                      {/* Set Joining Date */}
                      <div style={{ padding: '12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
                        <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>📅 Set Joining Date</div>
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <input
                            type="datetime-local"
                            value={d.joiningAt}
                            onChange={(e) =>
                              setDrafts((p) => ({
                                ...p,
                                [it.candidateId]: { ...d, joiningAt: e.target.value },
                              }))
                            }
                            style={{ flex: 1, minWidth: 200 }}
                          />
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => onSetJoiningDate(it)}
                            disabled={!!busyKey || !allowAction_('JOINING_SET_DATE', ['HR', 'ADMIN'])}
                          >
                            {busyKey === `${it.candidateId}:SET_DATE` ? <Spinner size={14} /> : null}
                            Set Date
                          </button>
                        </div>
                      </div>

                      {/* Docs Verification */}
                      <div style={{ padding: '12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
                        <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>
                          📄 Docs Verification
                          {hasDocs && <span className="badge" style={{ marginLeft: 8 }}>{it.docs.length} uploaded</span>}
                          {docsDone && <span className="badge" style={{ marginLeft: 8, background: '#22c55e', color: '#fff' }}>✓ Complete</span>}
                        </div>
                        {!docsDone ? (
                          <div style={{ marginBottom: 8 }}>
                            <SlaCountdown sla={it.docsSla} />
                          </div>
                        ) : null}

                        {hasDocs && (
                          <div style={{ marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {it.docs.slice(0, 5).map((doc, idx) => (
                              <button
                                key={`${it.candidateId}:doc:${idx}`}
                                className="button"
                                type="button"
                                onClick={() => viewFile(doc.fileId)}
                                style={{ fontSize: '12px', padding: '4px 8px' }}
                              >
                                📄 Doc {idx + 1}
                              </button>
                            ))}
                          </div>
                        )}

                        <input
                          type="file"
                          multiple
                          disabled={!allowAction_('DOCS_UPLOAD', ['HR', 'ADMIN'])}
                          onChange={(e) => {
                            const list = Array.from(e.target.files || []);
                            setSelectedFiles((p) => ({ ...p, [it.candidateId]: list }));
                          }}
                          style={{ marginBottom: 8 }}
                        />
                        {files.length > 0 && (
                          <div className="small" style={{ marginBottom: 8, color: 'var(--gray-600)' }}>
                            Selected: {files.map((f) => f.name).join(', ')}
                          </div>
                        )}

                        <div className="action-grid">
                          <button
                            className="button"
                            type="button"
                            onClick={() => onDocsUpload(it)}
                            disabled={!!busyKey || !allowAction_('DOCS_UPLOAD', ['HR', 'ADMIN'])}
                          >
                            {busyKey === `${it.candidateId}:DOCS_UPLOAD` ? <Spinner size={14} /> : null}
                            Upload Docs
                          </button>
                          <button
                            className="button"
                            type="button"
                            onClick={() => onDocsComplete(it)}
                            disabled={!hasDocs || !!busyKey || !allowAction_('DOCS_COMPLETE', ['HR', 'ADMIN'])}
                          >
                            {busyKey === `${it.candidateId}:DOCS_COMPLETE` ? <Spinner size={14} /> : null}
                            Docs Complete
                          </button>
                        </div>
                      </div>

                      {/* Mark Join */}
                      <div style={{ padding: '12px', background: isJoining && docsDone ? '#dcfce7' : 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
                        <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>🎉 Mark Join</div>
                        <button
                          className="button primary"
                          type="button"
                          onClick={() => onMarkJoin(it)}
                          disabled={!isJoining || !docsDone || !!busyKey || !allowAction_('MARK_JOIN', ['HR', 'ADMIN'])}
                          style={{ width: '100%' }}
                        >
                          {busyKey === `${it.candidateId}:MARK_JOIN` ? <Spinner size={14} /> : null}
                          Mark Joined
                        </button>
                        {!isJoining && (
                          <div className="small" style={{ marginTop: 6, color: 'var(--gray-500)' }}>
                            ⚠️ Locked until joining date is set
                          </div>
                        )}
                        {isJoining && !docsDone && (
                          <div className="small" style={{ marginTop: 6, color: 'var(--gray-500)' }}>
                            ⚠️ Locked until docs complete
                          </div>
                        )}
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
