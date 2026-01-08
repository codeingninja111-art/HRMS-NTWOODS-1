import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { templateList } from '../api/admin';
import {
  requirementCreate,
  requirementGet,
  requirementListByRole,
  requirementResubmit,
  requirementSubmit,
  requirementUpdate,
} from '../api/requirements';

function statusLabel(s) {
  const x = String(s || '').toUpperCase();
  if (x === 'DRAFT') return 'DRAFT';
  if (x === 'SUBMITTED') return 'SUBMITTED';
  if (x === 'CLARIFICATION') return 'CLARIFICATION';
  // UI label only: keep internal status as APPROVED but display as PROCESS.
  if (x === 'APPROVED') return 'PROCESS';
  if (x === 'CLOSED') return 'CLOSED';
  return x || '-';
}

function deriveRequirementMeta_(form, me) {
  const raisedFor = String(form?.jobRole || form?.jobTitle || '').trim() || 'Requirement';
  const concernedPerson = String(me?.fullName || me?.email || '').trim() || 'System';
  return { raisedFor, concernedPerson };
}

export function RequirementsPage() {
  const navigate = useNavigate();
  const { token, me, role, legacyRole, permissions, canPortal, canAction } = useAuth();

  const allowPortal_ = useCallback(
    (portalKey, legacyAllowed) => {
      if (!portalKey) return legacyAllowed;
      const v = canPortal ? canPortal(portalKey) : null;
      if (v === true || v === false) return v;
      return legacyAllowed;
    },
    [canPortal]
  );

  const allowAction_ = useCallback(
    (actionKey, legacyAllowed) => {
      const v = canAction ? canAction(actionKey) : null;
      if (v === true || v === false) return v;
      return legacyAllowed;
    },
    [canAction]
  );

  const legacy = legacyRole || role;
  const canAccess = allowPortal_('PORTAL_REQUIREMENTS', legacy === 'EA' || legacy === 'ADMIN');
  const canCreate = allowAction_('REQUIREMENT_CREATE', legacy === 'EA' || legacy === 'ADMIN');
  const canUpdate = allowAction_('REQUIREMENT_UPDATE', legacy === 'EA' || legacy === 'ADMIN');
  const canSubmit = allowAction_('REQUIREMENT_SUBMIT', legacy === 'EA' || legacy === 'ADMIN');
  const canResubmit = allowAction_('REQUIREMENT_RESUBMIT', legacy === 'EA' || legacy === 'ADMIN');

  const tabs = useMemo(
    () => [
      { key: 'OPEN', label: 'Open' },
      { key: 'CLARIFICATION', label: 'Clarification' },
      { key: 'CLOSED', label: 'Closed' },
    ],
    []
  );

  const [activeTab, setActiveTab] = useState('OPEN');

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [reqLoading, setReqLoading] = useState(false);
  const [requirements, setRequirements] = useState([]);
  const [counts, setCounts] = useState({ open: 0, clarification: 0, closed: 0 });

  const [loadingRequirementId, setLoadingRequirementId] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const emptyForm = useMemo(
    () => ({
      requirementId: null,
      templateId: '',
      jobRole: '',
      jobTitle: '',
      jd: '',
      responsibilities: '',
      skills: '',
      shift: '',
      payScale: '',
      perks: '',
      notes: '',
      requiredCount: 1,
      latestRemark: '',
      status: 'DRAFT',
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);
  const [resubmitRemark, setResubmitRemark] = useState('');

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await templateList(token, { status: 'ACTIVE', page: 1, pageSize: 500 });
      setTemplates(res.items ?? []);
    } catch (e) {
      toast.error(e?.message ?? 'Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, [token]);

  const loadRequirements = useCallback(async () => {
    setReqLoading(true);
    try {
      const res = await requirementListByRole(token, { tab: activeTab });
      setRequirements(res.items ?? []);
      setCounts(res.counts ?? { open: 0, clarification: 0, closed: 0 });
    } catch (e) {
      toast.error(e?.message ?? 'Failed to load requirements');
    } finally {
      setReqLoading(false);
    }
  }, [token, activeTab]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    loadRequirements();
  }, [loadRequirements]);

  const onSelectTemplate = useCallback(
    (templateId) => {
      const t = templates.find((x) => x.templateId === templateId);
      setForm((s) => ({
        ...s,
        templateId,
        jobRole: t?.jobRole ?? '',
        jobTitle: t?.jobTitle ?? '',
        jd: t?.jd ?? '',
        responsibilities: t?.responsibilities ?? '',
        skills: t?.skills ?? '',
        shift: t?.shift ?? '',
        payScale: t?.payScale ?? '',
        perks: t?.perks ?? '',
        notes: t?.notes ?? '',
      }));
    },
    [templates]
  );

    const templateOptions = useMemo(() => {
    return templates.map((t) => (
      <option key={t.templateId} value={t.templateId}>
        {t.jobRole} — {t.jobTitle}
      </option>
    ));
  }, [templates]);

  const onEditRequirement = useCallback(
    async (requirementId) => {
      setShowForm(true);
      setResubmitRemark('');
      setLoadingRequirementId(requirementId);
      try {
        const full = await requirementGet(token, { requirementId });
        setForm({
          requirementId: full.requirementId,
          templateId: full.templateId,
          jobRole: full.jobRole ?? '',
          jobTitle: full.jobTitle ?? '',
          jd: full.jd ?? '',
          responsibilities: full.responsibilities ?? '',
          skills: full.skills ?? '',
          shift: full.shift ?? '',
          payScale: full.payScale ?? '',
          perks: full.perks ?? '',
          notes: full.notes ?? '',
          requiredCount: full.requiredCount ?? 1,
          latestRemark: full.latestRemark ?? '',
          status: full.status ?? '',
        });
      } catch (e) {
        toast.error(e?.message ?? 'Failed to load requirement');
        setShowForm(false);
        setForm(emptyForm);
      } finally {
        setLoadingRequirementId('');
      }
    },
    [token]
  );

  const requirementRows = useMemo(() => {
    return (requirements || []).map((r) => (
      <tr key={r.requirementId} style={{ borderTop: '1px solid #eee' }}>
        <td className="small">{r.requirementId}</td>
        <td>{r.jobRole}</td>
        <td>{r.raisedFor || '-'}</td>
        <td>{r.requiredCount}</td>
        <td>{r.joinedCount ?? 0}</td>
        <td>
          <span className={String(r.status).toUpperCase() === 'CLARIFICATION' ? 'badge amber' : 'badge'}>
            {statusLabel(r.status)}
          </span>
        </td>
        <td className="small">
          {String(r.status).toUpperCase() === 'CLARIFICATION' ? (
            <span style={{ fontWeight: 600 }}>{r.latestRemark}</span>
          ) : (
            r.latestRemark || ''
          )}
        </td>
        <td>
          <button
            className="button"
            type="button"
            disabled={saving || reqLoading || Boolean(loadingRequirementId)}
            onClick={() => onEditRequirement(r.requirementId)}
          >
            Edit
          </button>
        </td>
      </tr>
    ));
  }, [requirements, saving, reqLoading, loadingRequirementId, onEditRequirement]);
async function saveDraft() {
    const isCreate = !form.requirementId;
    if (isCreate && !canCreate) {
      toast.error('Not allowed');
      return;
    }
    if (!isCreate && !canUpdate) {
      toast.error('Not allowed');
      return;
    }
    setSaving(true);
    try {
      if (!form.templateId) {
        toast.error('Select a template');
        return;
      }

      const meta = deriveRequirementMeta_(form, me);

      if (!form.requirementId) {
        const res = await requirementCreate(token, {
          templateId: form.templateId,
          jobRole: form.jobRole,
          jobTitle: form.jobTitle,
          jd: form.jd,
          responsibilities: form.responsibilities,
          skills: form.skills,
          shift: form.shift,
          payScale: form.payScale,
          perks: form.perks,
          notes: form.notes,
          raisedFor: meta.raisedFor,
          concernedPerson: meta.concernedPerson,
          requiredCount: Number(form.requiredCount),
        });
        toast.success('Draft created');
        setForm((s) => ({ ...s, requirementId: res.requirementId, status: 'DRAFT' }));
      } else {
        await requirementUpdate(token, {
          requirementId: form.requirementId,
          jobRole: form.jobRole,
          jobTitle: form.jobTitle,
          jd: form.jd,
          responsibilities: form.responsibilities,
          skills: form.skills,
          shift: form.shift,
          payScale: form.payScale,
          perks: form.perks,
          notes: form.notes,
          raisedFor: meta.raisedFor,
          concernedPerson: meta.concernedPerson,
          requiredCount: Number(form.requiredCount),
        });
        toast.success('Draft saved');
      }

      await loadRequirements();
    } catch (e) {
      toast.error(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function submitRequirement() {
    if (!form.requirementId) {
      toast.error('Save draft first');
      return;
    }
    if (!canSubmit) {
      toast.error('Not allowed');
      return;
    }
    setSaving(true);
    try {
      await requirementSubmit(token, { requirementId: form.requirementId });
      toast.success('Submitted to HR');
      setShowForm(false);
      setForm(emptyForm);
      await loadRequirements();
    } catch (e) {
      // Older drafts might miss sheet-level required fields (raisedFor/concernedPerson).
      // Auto-patch (no extra UI fields) and retry once.
      const msg = String(e?.message || '');
      if (msg === 'Missing required fields' && form.requirementId) {
        try {
          const meta = deriveRequirementMeta_(form, me);
          await requirementUpdate(token, {
            requirementId: form.requirementId,
            raisedFor: meta.raisedFor,
            concernedPerson: meta.concernedPerson,
            requiredCount: Number(form.requiredCount || 1),
          });
          await requirementSubmit(token, { requirementId: form.requirementId });
          toast.success('Submitted to HR');
          setShowForm(false);
          setForm(emptyForm);
          await loadRequirements();
          return;
        } catch (e2) {
          toast.error(e2?.message ?? 'Failed to submit');
          return;
        }
      }
      toast.error(e?.message ?? 'Failed to submit');
    } finally {
      setSaving(false);
    }
  }

  async function resubmitRequirement() {
    if (!form.requirementId) {
      toast.error('Select a requirement');
      return;
    }
    if (!resubmitRemark.trim()) {
      toast.error('Remark is required for resubmit');
      return;
    }
    if (!canResubmit) {
      toast.error('Not allowed');
      return;
    }
    setSaving(true);
    try {
      await requirementResubmit(token, { requirementId: form.requirementId, remark: resubmitRemark.trim() });
      toast.success('Resubmitted to HR');
      setResubmitRemark('');
      setShowForm(false);
      setForm(emptyForm);
      await loadRequirements();
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg === 'Missing required fields' && form.requirementId) {
        try {
          const meta = deriveRequirementMeta_(form, me);
          await requirementUpdate(token, {
            requirementId: form.requirementId,
            raisedFor: meta.raisedFor,
            concernedPerson: meta.concernedPerson,
            requiredCount: Number(form.requiredCount || 1),
          });
          await requirementResubmit(token, { requirementId: form.requirementId, remark: resubmitRemark.trim() });
          toast.success('Resubmitted');
          setShowForm(false);
          setForm(emptyForm);
          setResubmitRemark('');
          await loadRequirements();
          return;
        } catch (e2) {
          toast.error(e2?.message ?? 'Failed to resubmit');
          return;
        }
      }
      toast.error(e?.message ?? 'Failed to resubmit');
    } finally {
      setSaving(false);
    }
  }

  // Dynamic portal access: any role can be allowed via PORTAL_REQUIREMENTS.
  // If permissions haven't loaded yet, fall back to legacy EA/ADMIN.
  if (!canAccess && !permissions) {
    return (
      <AppLayout>
        <div className="card">This page is available for EA/Admin.</div>
      </AppLayout>
    );
  }

  if (permissions && !canAccess) {
    return (
      <AppLayout>
        <div className="card">Not allowed.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Requirements</h2>
          <div className="spacer" />
          <button className="button" onClick={() => navigate('/dashboard')}>Back</button>
        </div>

        <div style={{ height: 10 }} />
        <div className="tabs">
          <button
            className={['tab', activeTab === 'OPEN' ? 'active' : ''].join(' ')}
            onClick={() => setActiveTab('OPEN')}
            type="button"
          >
            Open
          </button>
          <button
            className={['tab', activeTab === 'CLARIFICATION' ? 'active' : ''].join(' ')}
            onClick={() => setActiveTab('CLARIFICATION')}
            type="button"
          >
            Clarification {counts.clarification ? `(${counts.clarification})` : ''}
          </button>
          <button
            className={['tab', activeTab === 'CLOSED' ? 'active' : ''].join(' ')}
            onClick={() => setActiveTab('CLOSED')}
            type="button"
          >
            Closed
          </button>
        </div>

        <div style={{ height: 12 }} />
        <div className="row">
          <div className="small">{reqLoading ? 'Loading…' : `${requirements.length} items`}</div>
          <div className="spacer" />
          <button
            className="button primary"
            type="button"
            onClick={() => {
              setForm(emptyForm);
              setResubmitRemark('');
              setShowForm(true);
            }}
            disabled={!canCreate}
          >
            Raise Requirement
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>{form.requirementId ? `Edit ${form.requirementId}` : 'Raise Requirement'}</h3>
            <div className="spacer" />
            <button className="button" type="button" onClick={() => { setShowForm(false); setForm(emptyForm); }}>
              Close
            </button>
          </div>

          {String(form.status).toUpperCase() === 'CLARIFICATION' && form.latestRemark ? (
            <div
              className="card"
              style={{
                marginTop: 12,
                background: '#fafafa',
                border: '1px solid #d0d5dd',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>HR Clarification Remark</div>
              <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{form.latestRemark}</div>
            </div>
          ) : null}

          <div style={{ height: 12 }} />

          {loadingRequirementId ? <div className="small">Loading {loadingRequirementId}…</div> : null}

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="small" style={{ display: 'grid', gap: 6 }}>
              Template
              <select
                value={form.templateId}
                onChange={(e) => onSelectTemplate(e.target.value)}
                disabled={templatesLoading || Boolean(form.requirementId)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 280 }}
              >
                <option value="">Select…</option>
                {templateOptions}
              </select>
              {form.requirementId ? <span className="small">Template locked after draft creation</span> : null}
            </label>

            <label className="small" style={{ display: 'grid', gap: 6 }}>
              Required Count
              <input
                type="number"
                value={form.requiredCount}
                min={1}
                step={1}
                onChange={(e) => setForm((s) => ({ ...s, requiredCount: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', width: 160 }}
              />
            </label>
          </div>

          <div style={{ height: 12 }} />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="small" style={{ display: 'grid', gap: 6 }}>
              Job Role
              <input
                value={form.jobRole}
                onChange={(e) => setForm((s) => ({ ...s, jobRole: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 220 }}
              />
            </label>
            <label className="small" style={{ display: 'grid', gap: 6 }}>
              Job Title
              <input
                value={form.jobTitle}
                onChange={(e) => setForm((s) => ({ ...s, jobTitle: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 260 }}
              />
            </label>
            <label className="small" style={{ display: 'grid', gap: 6 }}>
              Shift
              <input
                value={form.shift}
                onChange={(e) => setForm((s) => ({ ...s, shift: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 180 }}
              />
            </label>
            <label className="small" style={{ display: 'grid', gap: 6 }}>
              Pay Scale
              <input
                value={form.payScale}
                onChange={(e) => setForm((s) => ({ ...s, payScale: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 180 }}
              />
            </label>
          </div>

          <div style={{ height: 10 }} />
          <textarea
            placeholder="JD"
            value={form.jd}
            onChange={(e) => setForm((s) => ({ ...s, jd: e.target.value }))}
            rows={4}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
          />
          <div style={{ height: 8 }} />
          <textarea
            placeholder="Responsibilities"
            value={form.responsibilities}
            onChange={(e) => setForm((s) => ({ ...s, responsibilities: e.target.value }))}
            rows={3}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
          />
          <div style={{ height: 8 }} />
          <textarea
            placeholder="Skills"
            value={form.skills}
            onChange={(e) => setForm((s) => ({ ...s, skills: e.target.value }))}
            rows={3}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
          />
          <div style={{ height: 8 }} />
          <textarea
            placeholder="Perks"
            value={form.perks}
            onChange={(e) => setForm((s) => ({ ...s, perks: e.target.value }))}
            rows={2}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
          />
          <div style={{ height: 8 }} />
          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            rows={2}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
          />

          <div style={{ height: 12 }} />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button
              className="button"
              type="button"
              onClick={saveDraft}
              disabled={saving || (!form.requirementId ? !canCreate : !canUpdate)}
            >
              Save Draft
            </button>

            <button
              className="button primary"
              type="button"
              onClick={submitRequirement}
              disabled={saving || !form.requirementId || !canSubmit}
              title={!form.requirementId ? 'Save draft first' : !canSubmit ? 'Not allowed' : ''}
            >
              Submit
            </button>

            {String(form.status).toUpperCase() === 'CLARIFICATION' ? (
              <>
                <input
                  placeholder="Resubmit remark (required)"
                  value={resubmitRemark}
                  onChange={(e) => setResubmitRemark(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 260 }}
                />
                <button
                  className="button primary"
                  type="button"
                  onClick={resubmitRequirement}
                  disabled={saving || !resubmitRemark.trim() || !canResubmit}
                >
                  Resubmit
                </button>
              </>
            ) : null}

            <div className="spacer" />
            <div className="small">Status: {statusLabel(form.status)}</div>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>List</h3>
        <div style={{ overflowX: 'auto' }}>
          <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th align="left">Requirement</th>
                <th align="left">Role</th>
                <th align="left">Raised For</th>
                <th align="left">Required</th>
                <th align="left">Joined</th>
                <th align="left">Status</th>
                <th align="left">HR Remark</th>
                <th align="left">Action</th>
              </tr>
            </thead>
            <tbody>
              {requirementRows}
              {requirements.length === 0 ? (
                <tr>
                  <td className="small" colSpan={8} style={{ padding: 12 }}>
                    No requirements
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
