import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { rejectionLogList, rejectRevert } from '../api/candidates';
import { candidateDisplayName } from '../utils/pii';

function fmtDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function printCandidate(it) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) {
    toast.error('Popup blocked');
    return;
  }

  const logs = Array.isArray(it.logs) ? it.logs : [];
  const candidateName = candidateDisplayName(it) || it.candidateId;
  const rows = logs
    .map(
      (x) =>
        `<tr>
          <td>${escapeHtml(fmtDateTime(x.at))}</td>
          <td>${escapeHtml(x.stageTag)}</td>
          <td>${escapeHtml(x.remark)}</td>
          <td>${escapeHtml(x.actorRole)}</td>
          <td>${escapeHtml(x.actorUserId)}</td>
          <td>${escapeHtml(x.rejectionType)}</td>
          <td>${escapeHtml(x.autoRejectCode)}</td>
        </tr>`
    )
    .join('');

  w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Rejection Log - ${escapeHtml(it.candidateId)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 18px; }
    h2 { margin: 0 0 6px; }
    .small { color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; vertical-align: top; }
    th { background: #f6f6f6; text-align: left; }
  </style>
</head>
<body>
  <h2>Rejection Log</h2>
  <div class="small">Candidate: ${escapeHtml(candidateName)} (${escapeHtml(it.candidateId)})</div>
  <div class="small">Requirement: ${escapeHtml(it.requirementId)} ${it.jobTitle ? `· ${escapeHtml(it.jobTitle)}` : ''}</div>
  <div class="small">Role: ${escapeHtml(it.jobRole)} · Source: ${escapeHtml(it.source)}</div>
  <div class="small">Rejected At: ${escapeHtml(fmtDateTime(it.rejectedAt))}</div>
  <div class="small">Rejected From: ${escapeHtml(it.rejectedFromStatus)} · Reason: ${escapeHtml(it.rejectedReasonCode)}</div>
  <div class="small">Rejected Stage: ${escapeHtml(it.rejectedStageTag)} · Remark: ${escapeHtml(it.rejectedRemark)}</div>

  <table>
    <thead>
      <tr>
        <th>At</th>
        <th>Stage</th>
        <th>Remark</th>
        <th>Actor Role</th>
        <th>Actor User</th>
        <th>Type</th>
        <th>Auto Code</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7">No logs</td></tr>'}
    </tbody>
  </table>

  <script>window.print();</script>
</body>
</html>`);
  w.document.close();
}

export function RejectionLogPage() {
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

  const portalAllowed = allowPortal_('PORTAL_REJECTION_LOG', ['HR', 'EA', 'ADMIN']);
  const canLoad = portalAllowed && allowAction_('REJECTION_LOG_LIST', ['HR', 'EA', 'ADMIN']);
  const canRevert = portalAllowed && allowAction_('REJECT_REVERT', ['ADMIN']);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState({});
  const [busyKey, setBusyKey] = useState('');

  async function load() {
    if (!canLoad) return;
    setLoading(true);
    try {
      const res = await rejectionLogList(token);
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
  }, [canLoad]);

  const filtered = useMemo(() => {
    const needle = String(q || '').trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      const hay = [
        it.candidateId,
        it.requirementId,
        it.candidateName,
        it.candidateNameFull,
        it.mobile,
        it.mobileFull,
        it.jobRole,
        it.jobTitle,
        it.rejectedReasonCode,
        it.rejectedStageTag,
      ]
        .filter(Boolean)
        .join(' · ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  function toggle(it) {
    const k = `${it.candidateId}|${it.requirementId}`;
    setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  async function onRevert(it) {
    if (!canRevert) {
      toast.error('Not allowed');
      return;
    }
    const remark = window.prompt('Revert remark (optional):', '');
    if (remark == null) return;

    const k = `${it.candidateId}|${it.requirementId}:REVERT`;
    setBusyKey(k);
    try {
      await rejectRevert(token, { requirementId: it.requirementId, candidateId: it.candidateId, remark: String(remark || '').trim() });
      toast.success('Reverted');
      setItems((prev) => prev.filter((x) => !(x.candidateId === it.candidateId && x.requirementId === it.requirementId)));
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
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have access to Rejection Log portal.</div>
        </div>
      ) : !canLoad ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Not allowed</div>
          <div className="small" style={{ color: 'var(--gray-600)' }}>You don’t have permission to load Rejection Log.</div>
        </div>
      ) : null}

      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title">Rejection Log</h1>
        <p className="page-subtitle">
          {canRevert ? 'View all rejected candidates. You can revert rejections.' : 'View all rejected candidates (read-only).'}
        </p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="🔍 Search by Name, ID, Stage..."
              style={{ width: '100%' }}
            />
          </div>
          <button className="button" type="button" onClick={load} disabled={loading || !canLoad}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
          <span className="badge gray">{filtered.length} candidates</span>
        </div>
      </div>

      {filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
            <p className="small">No rejected candidates found.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {filtered.map((it) => {
              const k = `${it.candidateId}|${it.requirementId}`;
              const open = Boolean(expanded[k]);
              const logs = Array.isArray(it.logs) ? it.logs : [];

              return (
                <div key={k} className="card">
                  <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '16px' }}>
                          {candidateDisplayName(it) || it.candidateId}
                          {candidateDisplayName(it) && it.candidateId ? (
                            <span className="small" style={{ fontWeight: 400, marginLeft: 8, color: 'var(--gray-500)' }}>
                              ({it.candidateId})
                            </span>
                          ) : null}
                        </div>
                        <span className="badge red">{it.rejectedStageTag || 'REJECTED'}</span>
                      </div>
                      <div className="small" style={{ display: 'grid', gap: '4px' }}>
                        <div><strong>Position:</strong> {it.jobTitle ? `${it.jobTitle} · ` : ''}{it.jobRole}</div>
                        <div><strong>IDs:</strong> {it.candidateId} / {it.requirementId}</div>
                        <div><strong>Rejected:</strong> {fmtDateTime(it.rejectedAt) || '—'} {it.rejectedFromStatus ? `(from ${it.rejectedFromStatus})` : ''}</div>
                        {it.rejectedRemark && <div><strong>Remark:</strong> {it.rejectedRemark}</div>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="button sm" type="button" onClick={() => toggle(it)}>
                        {open ? '▲ Hide' : '▼ Logs'}
                      </button>
                      <button
                        className="button sm"
                        type="button"
                        onClick={() => downloadJson(`rejection_${it.candidateId}_${it.requirementId}.json`, it)}
                      >
                        ⬇ JSON
                      </button>
                      <button className="button sm" type="button" onClick={() => printCandidate(it)}>
                        🖨 Print
                      </button>
                      {canRevert && (
                        <button
                          className="button sm danger"
                          type="button"
                          onClick={() => onRevert(it)}
                          disabled={busyKey === `${k}:REVERT`}
                        >
                          {busyKey === `${k}:REVERT` ? '...' : '↩ Revert'}
                        </button>
                      )}
                    </div>
                  </div>

                  {open && (
                    <div style={{ marginTop: 16, borderTop: '1px solid var(--gray-100)', paddingTop: 16 }}>
                      <div className="section-title" style={{ fontSize: '14px' }}>📋 Rejection History ({logs.length})</div>
                      {logs.length === 0 ? (
                        <div className="small">No detailed logs available.</div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table>
                            <thead>
                              <tr>
                                <th>Date/Time</th>
                                <th>Stage</th>
                                <th>Remark</th>
                                <th>Actor</th>
                                <th>Type</th>
                                <th>Code</th>
                              </tr>
                            </thead>
                            <tbody>
                              {logs.map((l) => (
                                <tr key={l.logId || `${l.at}-${l.stageTag}`}> 
                                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(l.at)}</td>
                                  <td><span className="badge orange">{l.stageTag}</span></td>
                                  <td>{l.remark || '—'}</td>
                                  <td>{`${l.actorRole || ''}${l.actorUserId ? ` (${l.actorUserId})` : ''}`}</td>
                                  <td>{l.rejectionType || '—'}</td>
                                  <td>{l.autoRejectCode || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </AppLayout>
  );
}
