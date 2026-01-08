import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import {
  finalInterviewList,
  hrFinalHoldList,
  inpersonPipelineList,
  joiningList,
  ownerCandidatesList,
  precallList,
  probationList,
  rejectRevert,
} from '../api/candidates';
import { hrRequirementsList, requirementListByRole } from '../api/requirements';
import { clearRejectRevertDraft, loadRejectRevertDraft } from '../utils/storage';

function getTabsForRole(role) {
  switch (role) {
    case 'ADMIN':
      return [
        { key: 'overview', label: 'Overview' },
        { key: 'rejections', label: 'Rejection Log' },
        { key: 'requirements', label: 'Requirements' },
        { key: 'review', label: 'HR Review' },
        { key: 'jobposting', label: 'Job Posting' },
        { key: 'walkin', label: 'Walk-in' },
        { key: 'precall', label: 'Precall' },
        { key: 'preinterview', label: 'Pre-interview' },
        { key: 'inperson', label: 'In-person' },
        { key: 'final', label: 'Final' },
        { key: 'finalHold', label: 'Final Hold' },
        { key: 'joining', label: 'Joining' },
        { key: 'approvals', label: 'Owner' },
        { key: 'probation', label: 'Probation' },
        { key: 'admin', label: 'Admin' },
      ];
    case 'EA':
      return [
        { key: 'overview', label: 'Overview' },
        { key: 'requirements', label: 'My Requirements' },
        { key: 'rejections', label: 'Rejection Log' },
      ];
    case 'HR':
      return [
        { key: 'overview', label: 'Overview' },
        { key: 'rejections', label: 'Rejection Log' },
        { key: 'review', label: 'Requirement Review' },
        { key: 'jobposting', label: 'Job Posting' },
        { key: 'walkin', label: 'Walk-in' },
        { key: 'precall', label: 'Pre-interview Calls' },
        { key: 'preinterview', label: 'Pre-interview Scheduled' },
        { key: 'inperson', label: 'In-person Interview' },
        { key: 'final', label: 'Final Interview' },
        { key: 'finalHold', label: 'Final Hold' },
        { key: 'joining', label: 'Joining' },
        { key: 'probation', label: 'Probation' },
      ];
    case 'OWNER':
      return [
        { key: 'overview', label: 'Overview' },
        { key: 'approvals', label: 'Approvals' },
      ];
    default:
      return [{ key: 'overview', label: 'Overview' }];
  }
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { me, role, legacyRole, token, permissions, canPortal } = useAuth();

  const allowPortal_ = useCallback(
    (portalKey, legacyAllowed) => {
      if (!portalKey) return legacyAllowed;
      const v = canPortal ? canPortal(portalKey) : null;
      if (v === true || v === false) return v;
      return legacyAllowed;
    },
    [canPortal]
  );

  const tabs = useMemo(() => {
    // Prefer dynamic portal permissions when available.
    if (permissions) {
      const out = [{ key: 'overview', label: 'Overview' }];
      const add = (key, label, portalKey) => {
        if (allowPortal_(portalKey, false)) out.push({ key, label });
      };

      add('rejections', 'Rejection Log', 'PORTAL_REJECTION_LOG');
      add('requirements', 'Requirements', 'PORTAL_REQUIREMENTS');
      add('review', 'HR Review', 'PORTAL_HR_REVIEW');
      add('jobposting', 'Job Posting', 'PORTAL_HR_REVIEW');
      add('walkin', 'Walk-in', 'PORTAL_HR_REVIEW');
      add('precall', 'Precall', 'PORTAL_HR_PRECALL');
      add('preinterview', 'Pre-interview', 'PORTAL_HR_PREINTERVIEW');
      add('inperson', 'In-person', 'PORTAL_HR_INPERSON');
      add('final', 'Final', 'PORTAL_HR_FINAL');
      add('finalHold', 'Final Hold', 'PORTAL_HR_FINAL_HOLD');
      add('joining', 'Joining', 'PORTAL_HR_JOINING');
      add('probation', 'Probation', 'PORTAL_HR_PROBATION');
      add('approvals', 'Owner', 'PORTAL_OWNER');
      add('admin', 'Admin', 'PORTAL_ADMIN');
      return out;
    }

    // Legacy fallback when permissions haven't loaded yet.
    return getTabsForRole(legacyRole || role);
  }, [permissions, allowPortal_, legacyRole, role]);

  const [active, setActive] = useState(tabs[0]?.key ?? 'overview');
  const [revertDraft, setRevertDraft] = useState({ requirementId: '', candidateId: '', remark: '' });
  const [reverting, setReverting] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    if (!tabs || tabs.length === 0) return;
    if (tabs.some((t) => t.key === active)) return;
    setActive(tabs[0].key);
  }, [tabs, active]);

  useEffect(() => {
    const saved = loadRejectRevertDraft();
    if (!saved) return;
    if (!saved.requirementId || !saved.candidateId) return;

    setRevertDraft({
      requirementId: saved.requirementId,
      candidateId: saved.candidateId,
      remark: saved.remark || '',
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      if (active !== 'overview') {
        setOverview(null);
        setOverviewLoading(false);
        return;
      }

      const legacy = legacyRole || role;
      setOverviewLoading(true);

      const getTotal = (res) => {
        const t = res?.total;
        if (typeof t === 'number') return t;
        return 0;
      };

      try {
        const out = {};

        // Requirements: prefer HR view if user has HR portal, else show EA requirements.
        if (allowPortal_('PORTAL_HR_REVIEW', legacy === 'HR' || legacy === 'ADMIN')) {
          const [open, clarification, closed] = await Promise.all([
            hrRequirementsList(token, { tab: 'OPEN', countOnly: true }),
            hrRequirementsList(token, { tab: 'CLARIFICATION', countOnly: true }),
            hrRequirementsList(token, { tab: 'CLOSED', countOnly: true }),
          ]);
          out.requirements = {
            open: getTotal(open),
            clarification: getTotal(clarification),
            closed: getTotal(closed),
          };
        } else if (allowPortal_('PORTAL_REQUIREMENTS', legacy === 'EA' || legacy === 'ADMIN')) {
          const [open, clarification, closed] = await Promise.all([
            requirementListByRole(token, { tab: 'OPEN', countOnly: true }),
            requirementListByRole(token, { tab: 'CLARIFICATION', countOnly: true }),
            requirementListByRole(token, { tab: 'CLOSED', countOnly: true }),
          ]);
          out.requirements = {
            open: getTotal(open),
            clarification: getTotal(clarification),
            closed: getTotal(closed),
          };
        }

        // HR pipeline overview
        if (
          allowPortal_('PORTAL_HR_PRECALL', legacy === 'HR' || legacy === 'ADMIN') ||
          allowPortal_('PORTAL_HR_INPERSON', legacy === 'HR' || legacy === 'ADMIN') ||
          allowPortal_('PORTAL_HR_FINAL', legacy === 'HR' || legacy === 'ADMIN') ||
          allowPortal_('PORTAL_HR_FINAL_HOLD', legacy === 'HR' || legacy === 'ADMIN') ||
          allowPortal_('PORTAL_HR_JOINING', legacy === 'HR' || legacy === 'ADMIN') ||
          allowPortal_('PORTAL_HR_PROBATION', legacy === 'HR' || legacy === 'EA' || legacy === 'ADMIN')
        ) {
          const [precall, inperson, final, finalHold, joining, probation] = await Promise.all([
            precallList(token, { countOnly: true }),
            inpersonPipelineList(token, { countOnly: true }),
            finalInterviewList(token, { countOnly: true }),
            hrFinalHoldList(token, { countOnly: true }),
            joiningList(token, { countOnly: true }),
            probationList(token, { countOnly: true }),
          ]);
          out.hr = {
            precall: getTotal(precall),
            inperson: getTotal(inperson),
            finalInterview: getTotal(final),
            finalHold: getTotal(finalHold),
            joining: getTotal(joining),
            probation: getTotal(probation),
          };
        }

        // Owner queue
        if (allowPortal_('PORTAL_OWNER', legacy === 'OWNER' || legacy === 'ADMIN')) {
          const owner = await ownerCandidatesList(token, { countOnly: true });
          if (owner?.counts) {
            out.owner = {
              approvals: owner.counts.approvals ?? 0,
              final: owner.counts.final ?? 0,
            };
          } else {
            const items = owner?.items ?? [];
            out.owner = {
              approvals: items.filter((x) => {
                const st = String(x?.status || '').toUpperCase();
                return st === 'OWNER' || st === 'OWNER_HOLD';
              }).length,
              final: items.filter((x) => String(x?.status || '').toUpperCase() === 'FINAL_OWNER_PENDING').length,
            };
          }
        }

        if (!cancelled) setOverview(out);
      } catch (e) {
        if (!cancelled) setOverview(null);
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    }

    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [active, token, role, legacyRole, allowPortal_]);

  async function onRejectRevert() {
    const requirementId = String(revertDraft.requirementId || '').trim();
    const candidateId = String(revertDraft.candidateId || '').trim();
    const remark = String(revertDraft.remark || '').trim() || 'Revert';

    if (!requirementId || !candidateId) {
      toast.error('RequirementId and CandidateId are required');
      return;
    }

    setReverting(true);
    try {
      await rejectRevert(token, { requirementId, candidateId, remark });
      toast.success('Rejected candidate reverted');
      setRevertDraft({ requirementId: '', candidateId: '', remark: '' });
      clearRejectRevertDraft();
    } catch (e) {
      toast.error(e?.message || 'Revert failed');
    } finally {
      setReverting(false);
    }
  }

  const isAdmin = role === 'ADMIN';

  const MetricCard = useCallback(({ value, label, highlight, onClick }) => (
    <div className={`metric-card${highlight ? ' highlight' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="value">{value ?? '—'}</div>
      <div className="label">{label}</div>
    </div>
  ), []);

  const ActionCard = useCallback(({ icon, iconColor, title, desc, onClick }) => (
    <div className="action-card" onClick={onClick} role="button">
      <div className={`icon ${iconColor}`}>{icon}</div>
      <div className="text">
        <div className="title">{title}</div>
        <div className="desc">{desc}</div>
      </div>
    </div>
  ), []);

  const renderOverview = () => (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Welcome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Welcome back, {me?.fullName?.split(' ')[0] || 'User'}!</h1>
          <p className="page-subtitle">Here's your recruitment pipeline at a glance</p>
        </div>
        <div className="spacer" />
        {overviewLoading && <span className="badge blue">Syncing...</span>}
      </div>

      {/* Requirements Section */}
      {overview?.requirements && (
        <div className="card">
          <div className="section-title">📋 Requirements</div>
          <div className="metric-grid">
            <MetricCard value={overview.requirements.open} label="Open" highlight onClick={() => navigate('/requirements?tab=OPEN')} />
            <MetricCard value={overview.requirements.clarification} label="Clarification" onClick={() => navigate('/requirements?tab=CLARIFICATION')} />
            <MetricCard value={overview.requirements.closed} label="Closed" onClick={() => navigate('/requirements?tab=CLOSED')} />
          </div>
        </div>
      )}

      {/* HR Pipeline */}
      {overview?.hr && (
        <div className="card">
          <div className="section-title">👥 HR Pipeline</div>
          <div className="metric-grid">
            <MetricCard value={overview.hr.precall} label="Precall" onClick={() => navigate('/hr/precall')} />
            <MetricCard value={overview.hr.inperson} label="In-person" onClick={() => navigate('/hr/inperson')} />
            <MetricCard value={overview.hr.finalInterview} label="Final" onClick={() => navigate('/hr/final')} />
            <MetricCard value={overview.hr.finalHold} label="Final Hold" onClick={() => navigate('/hr/final-hold')} />
            <MetricCard value={overview.hr.joining} label="Joining" highlight={overview.hr.joining > 0} onClick={() => navigate('/hr/joining')} />
            <MetricCard value={overview.hr.probation} label="Probation" onClick={() => navigate('/hr/probation')} />
          </div>
        </div>
      )}

      {/* Owner Pipeline */}
      {overview?.owner && (
        <div className="card">
          <div className="section-title">👤 Owner Queue</div>
          <div className="metric-grid" style={{ maxWidth: '400px' }}>
            <MetricCard value={overview.owner.approvals} label="Approvals" highlight={overview.owner.approvals > 0} onClick={() => navigate('/owner')} />
            <MetricCard value={overview.owner.final} label="Final Pending" onClick={() => navigate('/owner')} />
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {overviewLoading && !overview && (
        <div className="card">
          <div className="metric-grid">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="skeleton" style={{ height: '80px' }} />
            ))}
          </div>
        </div>
      )}

      {/* Admin Revert Section */}
      {isAdmin && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="section-title" style={{ color: 'var(--danger)' }}>⚠️ Admin: Revert Rejection</div>
          <p className="small" style={{ margin: '0 0 16px' }}>Restore a rejected candidate to their previous pipeline status.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <div>
              <label className="small" style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Requirement ID</label>
              <input
                value={revertDraft.requirementId}
                onChange={(e) => setRevertDraft((p) => ({ ...p, requirementId: e.target.value }))}
                placeholder="REQ-..."
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="small" style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Candidate ID</label>
              <input
                value={revertDraft.candidateId}
                onChange={(e) => setRevertDraft((p) => ({ ...p, candidateId: e.target.value }))}
                placeholder="CAND-..."
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="small" style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Remark</label>
              <input
                value={revertDraft.remark}
                onChange={(e) => setRevertDraft((p) => ({ ...p, remark: e.target.value }))}
                placeholder="Reason for revert..."
                style={{ width: '100%' }}
              />
            </div>
            <button className="button danger" type="button" onClick={onRejectRevert} disabled={reverting}>
              {reverting ? 'Reverting…' : 'Revert Rejection'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderActionPage = (title, desc, icon, iconColor, path, btnText) => (
    <div className="card" style={{ maxWidth: '500px' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div className={`icon ${iconColor}`} style={{ width: '48px', height: '48px', borderRadius: '12px', fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '600' }}>{title}</h3>
          <p className="small" style={{ margin: '0 0 16px' }}>{desc}</p>
          <button className="button primary" onClick={() => navigate(path)}>{btnText || 'Open'}</button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (active === 'overview') return renderOverview();

    if (active === 'rejections' && (role === 'EA' || role === 'HR' || isAdmin)) {
      return renderActionPage('Rejection Log', 'View all rejected candidates with stage history and remarks. HR/EA: view-only. Admin: can revert.', '🚫', 'red', '/rejections', 'View Rejections');
    }

    if (active === 'requirements' && (role === 'EA' || isAdmin)) {
      return renderActionPage('Requirements', 'Raise requirements from templates, submit to HR, and resubmit clarifications.', '📋', 'blue', '/requirements', 'Open Requirements');
    }

    if (active === 'review' && (role === 'HR' || isAdmin)) {
      return renderActionPage('Requirement Review', 'Review submitted requirements, request clarifications, and approve.', '✅', 'green', '/hr/review', 'Open HR Review');
    }

    if (active === 'jobposting' && (role === 'HR' || isAdmin)) {
      return renderActionPage('Job Posting', 'Complete job postings for process requirements to unlock candidate addition.', '📢', 'blue', '/hr/review?tab=APPROVED&focus=JOBPOSTING', 'Open Job Posting');
    }

    if (active === 'walkin' && (role === 'HR' || isAdmin)) {
      return renderActionPage('Walk-in Scheduling', 'Schedule walk-ins for process requirements with completed job postings.', '🚶', 'green', '/hr/review?tab=APPROVED&focus=WALKIN', 'Open Walk-in');
    }

    if (active === 'precall' && (role === 'HR' || isAdmin)) {
      return renderActionPage('Pre-interview Calls', 'Track scheduled walk-ins, mark Not Pick, Call Done, or Reject.', '📞', 'blue', '/hr/precall', 'Open Precall');
    }

    if (active === 'preinterview' && (role === 'HR' || isAdmin)) {
      return renderActionPage('Pre-interview', 'Mark Appeared, Reschedule, Reject, and enter marks to generate test link.', '📝', 'orange', '/hr/preinterview', 'Open Pre-interview');
    }

    if (active === 'inperson' && (role === 'HR' || isAdmin)) {
      return renderActionPage('In-person Interview', 'Enter in-person marks (auto-reject if <6), select required tests.', '🏢', 'blue', '/hr/inperson', 'Open In-person');
    }

    if (active === 'final' && (role === 'HR' || isAdmin)) {
      return renderActionPage('Final Interview', 'Review candidates eligible for final interview.', '🎯', 'green', '/hr/final', 'Open Final Interview');
    }

    if (active === 'finalHold' && (role === 'HR' || isAdmin)) {
      return renderActionPage('Final Hold', 'Schedule date/time for candidates on Final Hold from Owner.', '⏸️', 'orange', '/hr/final-hold', 'Open Final Hold');
    }

    if (active === 'joining' && (role === 'HR' || isAdmin)) {
      return renderActionPage('Joining', 'Set joining date, upload documents, and mark join (locked until docs complete).', '🎉', 'green', '/hr/joining', 'Open Joining');
    }

    if (active === 'probation' && (role === 'HR' || role === 'EA' || isAdmin)) {
      return renderActionPage('Probation', 'Set probation days, complete, or reject with remark. Admin/EA can change role.', '📊', 'blue', '/hr/probation', 'Open Probation');
    }

    if (active === 'approvals' && (role === 'OWNER' || isAdmin)) {
      return renderActionPage('Owner Approvals', 'Approve for walk-in, hold with a deadline, or reject with remark.', '👤', 'blue', '/owner', 'Open Owner Portal');
    }

    if (active === 'admin' && isAdmin) {
      return renderActionPage('Admin Module', 'Manage Users, Job Templates, Settings, and System Logs.', '⚙️', 'gray', '/admin', 'Open Admin');
    }

    return (
      <div className="card">
        <p className="small">Select a tab to view content</p>
      </div>
    );
  };

  return (
    <AppLayout>
      <div style={{ marginBottom: '20px' }}>
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={['tab', active === t.key ? 'active' : ''].join(' ')}
              onClick={() => setActive(t.key)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {renderContent()}
    </AppLayout>
  );
}
