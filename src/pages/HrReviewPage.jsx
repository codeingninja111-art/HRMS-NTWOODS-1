import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import {
  hrRequirementsList,
  requirementGet,
  requirementApprove,
  requirementClarification,
} from '../api/requirements';

import {
  jobpostComplete,
  jobpostInit,
  jobpostMarkPortal,
  jobpostSetPortals,
  jobpostUploadScreenshot,
} from '../api/jobposting';

import {
  candidateAdd,
  candidateBulkAdd,
  copyTemplateData,
  shortlistHoldRevert,
  shortlistDecide,
  walkinSchedule,
  uploadCv,
} from '../api/candidates';
import { validateScheduleDateTimeLocal } from '../utils/scheduling';
import { openFile } from '../utils/files';
import { candidateDisplayName } from '../utils/pii';
import { SlaCountdown } from '../components/ui/SlaCountdown';

const TABS = [
  { key: 'REVIEW', label: 'Pending Review' },
  { key: 'PENDING_EA', label: 'Pending EA' },
  { key: 'APPROVED', label: 'Process' },
];

function requirementStatusLabel_(s) {
  const x = String(s || '').toUpperCase();
  // UI label only: keep internal status as APPROVED but display as PROCESS.
  if (x === 'APPROVED') return 'PROCESS';
  return x || '-';
}

export function HrReviewPage() {
  const { token, legacyRole, canPortal, canAction, canUi } = useAuth();
  const location = useLocation();

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

  const [tab, setTab] = useState('REVIEW');
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ review: 0, pendingEa: 0, approved: 0 });

  const [clarifyForId, setClarifyForId] = useState('');
  const [clarifyRemark, setClarifyRemark] = useState('');

  const [portalDraftByReq, setPortalDraftByReq] = useState({});
  const [uploadingKey, setUploadingKey] = useState('');
  const [markingKey, setMarkingKey] = useState('');
  const [completingId, setCompletingId] = useState('');
  const [copyingId, setCopyingId] = useState('');

  const [candidateFormByReq, setCandidateFormByReq] = useState({});
  const [candidateSavingId, setCandidateSavingId] = useState('');
  const [bulkState, setBulkState] = useState({ open: false, current: 0, total: 0, errors: [] });

  const [candidateTabByReq, setCandidateTabByReq] = useState({});
  const [decisionModal, setDecisionModal] = useState({ open: false, requirementId: '', candidate: null });
  const [decisionRemark, setDecisionRemark] = useState('');
  const [decidingKey, setDecidingKey] = useState('');

  // Bulk shortlisting (SHORTLISTING tab)
  const [shortlistSelectByReq, setShortlistSelectByReq] = useState({});
  const [shortlistBulkModal, setShortlistBulkModal] = useState({ open: false, requirementId: '' });
  const [shortlistBulkDecision, setShortlistBulkDecision] = useState('OWNER_SEND');
  const [shortlistBulkRemark, setShortlistBulkRemark] = useState('');
  const [shortlistBulkState, setShortlistBulkState] = useState({ open: false, current: 0, total: 0, errors: [] });

  const [walkinDraftByKey, setWalkinDraftByKey] = useState({});
  const [walkinSelectByReq, setWalkinSelectByReq] = useState({});
  const [walkinBulkDraftByReq, setWalkinBulkDraftByReq] = useState({});
  const [interviewTemplate, setInterviewTemplate] = useState('');

  // UI-only: candidate section main tabs (single/bulk/list)
  const [candidateMainTabByReq, setCandidateMainTabByReq] = useState({});

  // UI-only: sticky context header
  const [activeRequirementId, setActiveRequirementId] = useState('');
  const reqCardElsRef = useRef({});

  // Full requirement details (loaded on-demand for the currently selected requirement)
  const [fullRequirementById, setFullRequirementById] = useState({});
  const [fullRequirementLoadingId, setFullRequirementLoadingId] = useState('');

  const badges = useMemo(
    () => ({
      REVIEW: counts.review,
      PENDING_EA: counts.pendingEa,
      APPROVED: counts.approved,
    }),
    [counts]
  );

  useEffect(() => {
    const sp = new URLSearchParams(location.search || '');
    const nextTab = String(sp.get('tab') || '').toUpperCase().trim();
    const nextFocus = String(sp.get('focus') || '').toUpperCase().trim();
    if (['REVIEW', 'PENDING_EA', 'APPROVED', 'ALL'].includes(nextTab) && nextTab !== tab) {
      setTab(nextTab);
    }
    setFocus(nextFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  async function refresh(nextTab = tab) {
    setLoading(true);
    try {
      const res = await hrRequirementsList(token, { tab: nextTab });
      const nextItems = res.items || [];
      setItems(nextItems);
      setCounts(res.counts || { review: 0, pendingEa: 0, approved: 0 });

      if (focus === 'WALKIN') {
        // Best-effort: pre-select WALKIN tab for requirements that have walk-in candidates.
        const next = {};
        nextItems.forEach((it) => {
          const all = it.candidates || [];
          const walkin = all.filter((c) => {
            const st = String(c.status || '').toUpperCase();
            return st === 'WALKIN_PENDING' || st === 'WALKIN_SCHEDULED';
          });
          if (walkin.length) next[it.requirementId] = 'WALKIN';
        });
        if (Object.keys(next).length) setCandidateTabByReq((s) => ({ ...s, ...next }));
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to load requirements');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // UI-only: keep a "current requirement" for the sticky header.
  useEffect(() => {
    if (!activeRequirementId && items && items.length) {
      setActiveRequirementId(items[0].requirementId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    // Track which requirement card is in view so context isn't lost during scroll.
    // UI-only: does not affect data flow or API calls.
    if (!items || items.length === 0) return;

    const els = reqCardElsRef.current || {};
    const nodes = items
      .map((it) => els[it.requirementId])
      .filter(Boolean);

    if (nodes.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the most visible card.
        let best = null;
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          if (!e.isIntersecting) continue;
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
        if (best && best.target) {
          const rid = best.target.getAttribute('data-requirement-id') || '';
          if (rid) setActiveRequirementId(rid);
        }
      },
      { root: null, threshold: [0.35, 0.5, 0.65], rootMargin: '-20% 0px -65% 0px' }
    );

    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [items]);

  // Data: load full requirement payload for the currently selected requirement.
  // This keeps HR_REQUIREMENTS_LIST lightweight, while Job Information stays accurate.
  useEffect(() => {
    const requirementId = String(activeRequirementId || '').trim();
    if (!requirementId) return;
    if (fullRequirementById[requirementId]) return;

    let cancelled = false;
    (async () => {
      setFullRequirementLoadingId(requirementId);
      try {
        const full = await requirementGet(token, { requirementId });
        if (cancelled) return;
        setFullRequirementById((s) => ({ ...s, [requirementId]: full || null }));
      } catch (e) {
        // Best-effort only; fallback UI uses list payload.
      } finally {
        if (!cancelled) setFullRequirementLoadingId('');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeRequirementId, token, fullRequirementById]);

  useEffect(() => {
    (async () => {
      try {
        const res = await copyTemplateData(token);
        setInterviewTemplate(String(res?.interviewMessageTemplate || ''));
      } catch (e) {
        // ignore; copy button will warn
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onApprove(requirementId) {
    if (!allowAction_('REQUIREMENT_APPROVE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    try {
      await requirementApprove(token, { requirementId });
      toast.success('Moved to Process');
      await refresh(tab);
    } catch (err) {
      toast.error(err?.message || 'Approve failed');
    }
  }

  function getDraft(requirementId) {
    return portalDraftByReq[requirementId] || {
      NAUKRI: false,
      APNA: false,
      INDEED: false,
      WORKINDIA: false,
      customEnabled: false,
      customName: '',
    };
  }

  function setDraft(requirementId, patch) {
    setPortalDraftByReq((s) => ({
      ...s,
      [requirementId]: { ...getDraft(requirementId), ...patch },
    }));
  }

  async function onInitJobpost(requirementId) {
    if (!allowAction_('JOBPOST_INIT', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    try {
      await jobpostInit(token, { requirementId });
      toast.success('JobPosting initialized');
      await refresh(tab);
    } catch (err) {
      toast.error(err?.message || 'Init failed');
    }
  }

  async function onSetPortals(requirementId) {
    if (!allowAction_('JOBPOST_SET_PORTALS', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const d = getDraft(requirementId);
    const portals = [];
    if (d.NAUKRI) portals.push('NAUKRI');
    if (d.APNA) portals.push('APNA');
    if (d.INDEED) portals.push('INDEED');
    if (d.WORKINDIA) portals.push('WORKINDIA');
    if (d.customEnabled) {
      const name = String(d.customName || '').trim();
      if (!name) {
        toast.error('Enter custom portal name');
        return;
      }
      portals.push(name);
    }

    try {
      await jobpostSetPortals(token, { requirementId, portals });
      toast.success('Portals saved');
      await refresh(tab);
    } catch (err) {
      toast.error(err?.message || 'Failed to set portals');
    }
  }

  async function fileToBase64(file) {
    const buf = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function getCandidateForm(requirementId) {
    return candidateFormByReq[requirementId] || { candidateName: '', mobile: '', source: '', file: null };
  }

  function setCandidateForm(requirementId, patch) {
    setCandidateFormByReq((s) => ({
      ...s,
      [requirementId]: { ...getCandidateForm(requirementId), ...patch },
    }));
  }

  async function onAddCandidate(requirementId) {
    if (!allowAction_('FILE_UPLOAD_CV', ['HR', 'ADMIN']) || !allowAction_('CANDIDATE_ADD', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const f = getCandidateForm(requirementId);
    const candidateName = String(f.candidateName || '').trim();
    const mobile = String(f.mobile || '').trim();
    const source = String(f.source || '').trim();
    const file = f.file;

    if (!candidateName || !mobile || !file) {
      toast.error('Name, Mobile and CV are required');
      return;
    }

    setCandidateSavingId(requirementId);
    try {
      const base64 = await fileToBase64(file);
      const up = await uploadCv(token, {
        requirementId,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
      });

      await candidateAdd(token, {
        requirementId,
        candidateName,
        mobile,
        source,
        cvFileId: up.fileId,
        cvFileName: up.fileName || file.name,
      });

      toast.success('Candidate added');
      setCandidateForm(requirementId, { candidateName: '', mobile: '', source: '', file: null });
      await refresh(tab);
    } catch (err) {
      toast.error(err?.message || 'Add candidate failed');
    } finally {
      setCandidateSavingId('');
    }
  }

  function parseFilenameTriplet(filename) {
    const base = String(filename || '').replace(/\.[^.]+$/, '');
    const parts = base.split('_');
    if (parts.length < 3) return null;
    const candidateName = parts[0]?.trim();
    const mobile = parts[1]?.trim();
    const source = parts.slice(2).join('_').trim();
    if (!candidateName || !mobile || !source) return null;
    return { candidateName, mobile, source };
  }

  async function onBulkUpload(requirementId, files) {
    if (!allowAction_('FILE_UPLOAD_CV', ['HR', 'ADMIN']) || !allowAction_('CANDIDATE_BULK_ADD', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const list = Array.from(files || []);
    if (list.length === 0) return;
    if (list.length > 50) {
      toast.error('Max 50 files');
      return;
    }

    setBulkState({ open: true, current: 0, total: list.length, errors: [] });

    const items = [];
    const errors = [];

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setBulkState((s) => ({ ...s, current: i + 1 }));

      const parsed = parseFilenameTriplet(file.name);
      if (!parsed) {
        errors.push({ file: file.name, message: 'Parse failed (expected Name_Mobile_Source)' });
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const up = await uploadCv(token, {
          requirementId,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64,
        });
        items.push({
          candidateName: parsed.candidateName,
          mobile: parsed.mobile,
          source: parsed.source,
          cvFileId: up.fileId,
          cvFileName: up.fileName || file.name,
        });
      } catch (e) {
        errors.push({ file: file.name, message: e?.message || 'Upload failed' });
      }
    }

    try {
      if (items.length > 0) {
        const res = await candidateBulkAdd(token, { requirementId, items });
        (res.errors || []).forEach((er) => errors.push({ file: `item#${er.index}`, message: er.message }));
        toast.success(`Bulk added: ${res.created?.length || 0}`);
      } else {
        toast.error('No valid files to add');
      }
      await refresh(tab);
    } catch (err) {
      toast.error(err?.message || 'Bulk add failed');
    } finally {
      setBulkState((s) => ({ ...s, open: true, errors }));
    }
  }

  function getCandidateTab(requirementId) {
    return candidateTabByReq[requirementId] || 'SHORTLISTING';
  }

  function setCandidateTab(requirementId, tabKey) {
    setCandidateTabByReq((s) => ({ ...s, [requirementId]: tabKey }));
  }

  function openDecision(requirementId, candidate) {
    setDecisionRemark('');
    setDecisionModal({ open: true, requirementId, candidate });
  }

  function getShortlistSelectedMap_(requirementId) {
    return shortlistSelectByReq[requirementId] || {};
  }

  function setShortlistSelected_(requirementId, candidateId, checked) {
    setShortlistSelectByReq((s) => {
      const prev = s[requirementId] || {};
      const next = { ...prev };
      if (checked) next[candidateId] = true;
      else delete next[candidateId];
      return { ...s, [requirementId]: next };
    });
  }

  async function onBulkShortlistApply_(requirementId) {
    if (!allowAction_('SHORTLIST_DECIDE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const selectedIds = Object.keys(getShortlistSelectedMap_(requirementId));
    if (selectedIds.length === 0) {
      toast.error('Select candidates');
      return;
    }

    const decision = String(shortlistBulkDecision || '').toUpperCase().trim();
    const remark = String(shortlistBulkRemark || '').trim();
    if ((decision === 'HOLD' || decision === 'REJECT') && !remark) {
      toast.error('Remark required');
      return;
    }

    setShortlistBulkModal({ open: false, requirementId: '' });
    setShortlistBulkState({ open: true, current: 0, total: selectedIds.length, errors: [] });

    let okCount = 0;
    const errors = [];
    for (let i = 0; i < selectedIds.length; i++) {
      const candidateId = selectedIds[i];
      setShortlistBulkState((s) => ({ ...s, current: i + 1 }));
      try {
        await shortlistDecide(token, { requirementId, candidateId, decision, remark });
        okCount++;
      } catch (e) {
        errors.push({ file: `${candidateId}`, message: e?.message || 'Failed' });
      }
    }

    setShortlistBulkState((s) => ({ ...s, errors }));
    if (errors.length) toast.error(`Bulk updated: ${okCount}, errors: ${errors.length}`);
    else toast.success(`Bulk updated: ${okCount}`);

    setShortlistSelectByReq((s) => ({ ...s, [requirementId]: {} }));
    await refresh(tab);
  }

  async function onDecide(decision) {
    if (!allowAction_('SHORTLIST_DECIDE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }

    if (String(decision || '').toUpperCase() === 'OWNER_SEND') {
      if (!allowUi_('BTN_SHORTLIST_OWNER_SEND', ['HR', 'ADMIN'])) {
        toast.error('Not allowed');
        return;
      }
    }

    const requirementId = decisionModal.requirementId;
    const candidateId = decisionModal.candidate?.candidateId;
    if (!requirementId || !candidateId) return;

    const remark = String(decisionRemark || '').trim();
    if ((decision === 'REJECT' || decision === 'HOLD') && !remark) {
      toast.error('Remark required');
      return;
    }

    const key = `${requirementId}:${candidateId}:${decision}`;
    setDecidingKey(key);
    try {
      await shortlistDecide(token, { requirementId, candidateId, decision, remark });
      toast.success('Updated');
      setDecisionModal({ open: false, requirementId: '', candidate: null });
      setDecisionRemark('');
      await refresh(tab);
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setDecidingKey('');
    }
  }

  async function onRevertHold(requirementId, candidateId) {
    if (!allowAction_('SHORTLIST_HOLD_REVERT', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${requirementId}:${candidateId}:REVERT`;
    setDecidingKey(key);
    try {
      await shortlistHoldRevert(token, { requirementId, candidateId, remark: 'Revert' });
      toast.success('Reverted');
      await refresh(tab);
    } catch (err) {
      toast.error(err?.message || 'Revert failed');
    } finally {
      setDecidingKey('');
    }
  }

  async function onUploadScreenshot(requirementId, portalKey, file) {
    if (!file) return;
    if (!allowAction_('JOBPOST_UPLOAD_SCREENSHOT', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${requirementId}:${portalKey}`;
    setUploadingKey(key);
    try {
      const base64 = await fileToBase64(file);
      await jobpostUploadScreenshot(token, {
        requirementId,
        portalKey,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
      });
      toast.success('Screenshot uploaded');
      await refresh(tab);
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploadingKey('');
    }
  }

  async function onMarkPosted(requirementId, portalKey) {
    if (!allowAction_('JOBPOST_MARK_PORTAL', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const key = `${requirementId}:${portalKey}`;
    setMarkingKey(key);
    try {
      await jobpostMarkPortal(token, { requirementId, portalKey });
      toast.success('Marked posted');
      await refresh(tab);
    } catch (err) {
      toast.error(err?.message || 'Mark failed');
    } finally {
      setMarkingKey('');
    }
  }

  async function onComplete(requirementId) {
    if (!allowAction_('JOBPOST_COMPLETE', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    setCompletingId(requirementId);
    try {
      await jobpostComplete(token, { requirementId });
      toast.success('JobPosting complete');
      await refresh(tab);
    } catch (err) {
      toast.error(err?.message || 'Complete failed');
    } finally {
      setCompletingId('');
    }
  }

  async function onCopyJd(requirementId) {
    if (!allowAction_('REQUIREMENT_GET', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    setCopyingId(requirementId);
    try {
      const cached = fullRequirementById[requirementId];
      const full = cached || (await requirementGet(token, { requirementId }));
      if (!cached) setFullRequirementById((s) => ({ ...s, [requirementId]: full || null }));
      const text = String(full?.jd || '').trim();
      if (!text) {
        toast.error('JD is empty');
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success('JD copied');
    } catch (err) {
      toast.error(err?.message || 'Copy failed');
    } finally {
      setCopyingId('');
    }
  }

  async function onRequestClarification() {
    if (!clarifyForId) return;
    if (!allowAction_('REQUIREMENT_CLARIFICATION', ['HR', 'ADMIN'])) {
      toast.error('Not allowed');
      return;
    }
    const remark = String(clarifyRemark || '').trim();
    if (!remark) {
      toast.error('Remark required');
      return;
    }
    try {
      await requirementClarification(token, { requirementId: clarifyForId, remark });
      toast.success('Sent to EA for clarification');
      setClarifyForId('');
      setClarifyRemark('');
      await refresh(tab);
    } catch (err) {
      toast.error(err?.message || 'Clarification failed');
    }
  }

  function getCandidateMainTab(requirementId, candidateCount) {
    const existing = candidateMainTabByReq[requirementId];
    if (existing) return existing;
    const n = Number(candidateCount || 0);
    return n === 0 ? 'BULK' : 'LIST';
  }

  function setCandidateMainTab(requirementId, tabKey) {
    setCandidateMainTabByReq((s) => ({
      ...s,
      [requirementId]: tabKey,
    }));
  }

  function getVisualStep_(it) {
    const reqStatus = String(it?.status || '').toUpperCase();
    const jpStatus = String(it?.jobPostingState?.status || it?.jobPostingStatus || '').toUpperCase();
    const candCount = Number(it?.candidateCount || (it?.candidates || []).length || 0);

    // Visual only (no workflow dependency): guides HR through bulk flow.
    if (reqStatus === 'SUBMITTED') return 'REVIEW';
    if (reqStatus === 'APPROVED' && jpStatus !== 'COMPLETE') return 'SOURCE';
    if (jpStatus === 'COMPLETE' && candCount === 0) return 'CANDIDATES';
    if (jpStatus === 'COMPLETE' && candCount > 0) return 'REVIEW';
    return 'JOB';
  }

  const activeRequirement = useMemo(() => {
    if (!items || items.length === 0) return null;
    return items.find((x) => x.requirementId === activeRequirementId) || items[0] || null;
  }, [items, activeRequirementId]);

  return (
    <div className="hr-review" style={{ padding: 16 }}>
      {!allowPortal_('PORTAL_HR_REVIEW', ['HR', 'ADMIN']) ? (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Not allowed</div>
          <div className="hr-muted">You don’t have access to HR Review portal.</div>
        </div>
      ) : null}
      <div className="hr-stickyContext" role="region" aria-label="Current requirement context">
        <div className="hr-stickyLeft">
          <div className="hr-stickyTitle">Current Requirement</div>
          <div className="hr-stickyMeta">
            {activeRequirement ? (
              <>
                <span className="hr-mono">{activeRequirement.requirementId}</span>
                <span className="hr-dot">•</span>
                <span>{activeRequirement.jobTitle || activeRequirement.jobRole || activeRequirement.templateId || '-'}</span>
                <span className="hr-dot">•</span>
                <span>Candidates: {Number(activeRequirement.candidateCount || 0)}</span>
                <span className="hr-dot">•</span>
                <span>Status: {String(activeRequirement.status || '-')}</span>
              </>
            ) : (
              <span style={{ color: '#666' }}>No selection</span>
            )}
          </div>
        </div>

        {/* Visual step indicator (UI-only guidance) */}
        <div className="hr-stepper" aria-label="Workflow steps">
          {(() => {
            const step = activeRequirement ? getVisualStep_(activeRequirement) : 'JOB';
            const steps = [
              { k: 'JOB', label: 'Job Info' },
              { k: 'SOURCE', label: 'Source Upload' },
              { k: 'CANDIDATES', label: 'Candidates' },
              { k: 'REVIEW', label: 'Review' },
            ];
            return steps.map((s, idx) => (
              <div key={s.k} className={"hr-step" + (step === s.k ? ' isActive' : '')}>
                <span className="hr-stepNum">{idx + 1}</span>
                <span className="hr-stepLabel">{s.label}</span>
              </div>
            ));
          })()}
        </div>
      </div>

      <h2 style={{ marginBottom: 12 }}>HR Review</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 10px',
              border: '1px solid #ddd',
              borderRadius: 6,
              background: tab === t.key ? '#f3f3f3' : '#fff',
              cursor: 'pointer',
            }}
          >
            {t.label} {badges[t.key] ? `(${badges[t.key]})` : ''}
          </button>
        ))}

        <button
          onClick={() => refresh(tab)}
          style={{
            padding: '6px 10px',
            border: '1px solid #ddd',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          Refresh
        </button>
      </div>

      {loading ? <div>Loading…</div> : null}

      {items.length === 0 && !loading ? (
        <div style={{ color: '#666' }}>No items.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((it) => (
            <div
              key={it.requirementId}
              className="hr-card"
              data-requirement-id={it.requirementId}
              ref={(el) => {
                if (!reqCardElsRef.current) reqCardElsRef.current = {};
                if (el) reqCardElsRef.current[it.requirementId] = el;
                else delete reqCardElsRef.current[it.requirementId];
              }}
              style={{ border: '1px solid #eee', borderRadius: 10, padding: 12 }}
            >
              <button
                type="button"
                className="hr-cardHeader"
                onClick={() => setActiveRequirementId(it.requirementId)}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <div className="hr-cardTitle">
                  {it.jobTitle || it.jobRole || it.templateId || it.requirementId}
                </div>
                <div className="hr-cardSub">
                  <span className="hr-mono">{it.requirementId}</span>
                  <span className="hr-dot">•</span>
                  <span>{requirementStatusLabel_(it.status)}</span>
                  {it.jobPostingStatus ? (
                    <>
                      <span className="hr-dot">•</span>
                      <span>JobPosting: {it.jobPostingStatus}</span>
                    </>
                  ) : null}
                  <span className="hr-dot">•</span>
                  <span>Candidates: {Number(it.candidateCount || 0)}</span>
                </div>
                <SlaCountdown sla={it.sla} />
              </button>

              {/* Accordion sections (UI-only). Default open: Candidates (when available). */}
              <div className="hr-sections">
                <details className="hr-section">
                  <summary className="hr-summary">Job Information</summary>
                  <div className="hr-sectionBody">
                    {(() => {
                      const full = fullRequirementById[it.requirementId];
                      const job = full || it;
                      const loadingFull = fullRequirementLoadingId === it.requirementId;
                      return (
                    <div className="hr-kv">
                      <div>
                        <b>Role:</b> {job.jobRole || '-'}
                      </div>
                      <div>
                        <b>Title:</b> {job.jobTitle || '-'}
                      </div>
                      <div>
                        <b>Shift:</b> {job.shift || '-'}
                      </div>
                      <div>
                        <b>Pay Scale:</b> {job.payScale || '-'}
                      </div>
                      <div>
                        <b>Required:</b> {job.requiredCount ?? '-'} • <b>Joined:</b> {job.joinedCount ?? '-'}
                      </div>
                      {job.notes ? (
                        <div>
                          <b>Notes:</b> <span style={{ whiteSpace: 'pre-wrap' }}>{job.notes}</span>
                        </div>
                      ) : null}

                      {/* Optional legacy fields (kept for backward compatibility) */}
                      {job.raisedFor ? (
                        <div>
                          <b>Raised For:</b> {job.raisedFor}
                        </div>
                      ) : null}
                      {job.concernedPerson ? (
                        <div>
                          <b>Concerned Person:</b> {job.concernedPerson}
                        </div>
                      ) : null}

                      {loadingFull ? <div className="hr-muted">Loading full details…</div> : null}

                      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                        <details className="hr-section">
                          <summary className="hr-summary">JD</summary>
                          <div className="hr-sectionBody" style={{ whiteSpace: 'pre-wrap' }}>
                            {job.jd || '-'}
                          </div>
                        </details>
                        <details className="hr-section">
                          <summary className="hr-summary">Responsibilities</summary>
                          <div className="hr-sectionBody" style={{ whiteSpace: 'pre-wrap' }}>
                            {job.responsibilities || '-'}
                          </div>
                        </details>
                        <details className="hr-section">
                          <summary className="hr-summary">Skills</summary>
                          <div className="hr-sectionBody" style={{ whiteSpace: 'pre-wrap' }}>
                            {job.skills || '-'}
                          </div>
                        </details>
                        <details className="hr-section">
                          <summary className="hr-summary">Perks</summary>
                          <div className="hr-sectionBody" style={{ whiteSpace: 'pre-wrap' }}>
                            {job.perks || '-'}
                          </div>
                        </details>
                      </div>

                      {it.latestRemark ? (
                        <div>
                          <b>Latest Remark:</b> {it.latestRemark}
                        </div>
                      ) : null}
                    </div>
                      );
                    })()}
                  </div>
                </details>

                <details
                  className="hr-section"
                  open={String(it.status || '').toUpperCase() === 'APPROVED' && String(it.jobPostingState?.status || '').toUpperCase() !== 'COMPLETE'}
                >
                  <summary className="hr-summary">Source Upload (Naukri / Apna / etc)</summary>
                  <div className="hr-sectionBody">
                    {String(it.status || '').toUpperCase() === 'APPROVED' ? (
                      <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 600 }}>Job Posting</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Status: {it.jobPostingState?.status || 'NOT_STARTED'}
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => onCopyJd(it.requirementId)}
                                disabled={copyingId === it.requirementId || !allowAction_('REQUIREMENT_GET', ['HR', 'ADMIN'])}
                        className="hr-btn hr-btnSecondary"
                      >
                        Copy JD
                      </button>
                    </div>
                  </div>

                  {!it.jobPostingState ? (
                    <div style={{ marginTop: 10 }}>
                      <button
                        onClick={() => onInitJobpost(it.requirementId)}
                        className="hr-btn hr-btnPrimary"
                        disabled={!allowAction_('JOBPOST_INIT', ['HR', 'ADMIN'])}
                      >
                        Init JobPosting
                      </button>
                    </div>
                  ) : null}

                  {it.jobPostingState ? (
                    <>
                      {Array.isArray(it.jobPostingState?.checklistState?.selectedPortals) &&
                      it.jobPostingState.checklistState.selectedPortals.length > 0 ? (
                        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                          {(it.jobPostingState.checklistState.selectedPortals || []).map((p) => {
                            const portalState = it.jobPostingState.checklistState.portals?.[p.key] || {};
                            const uploaded = Boolean(portalState.screenshotFileId);
                            const posted = Boolean(portalState.posted);
                            const busyUpload = uploadingKey === `${it.requirementId}:${p.key}`;
                            const busyMark = markingKey === `${it.requirementId}:${p.key}`;

                            return (
                              <div
                                key={p.key}
                                style={{
                                  border: '1px solid #eee',
                                  borderRadius: 8,
                                  padding: 10,
                                  display: 'flex',
                                  gap: 10,
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                }}
                              >
                                <div style={{ minWidth: 160 }}>
                                  <div style={{ fontWeight: 600 }}>{p.label}</div>
                                  <div style={{ fontSize: 12, color: '#666' }}>
                                    {posted ? 'Posted' : 'Not posted'}
                                    {uploaded ? ' • Screenshot uploaded' : ' • Screenshot required'}
                                  </div>
                                </div>

                                <label style={{ fontSize: 12 }}>
                                  Screenshot
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={
                                      String(it.jobPostingState?.status || '').toUpperCase() === 'COMPLETE' ||
                                      !allowAction_('JOBPOST_UPLOAD_SCREENSHOT', ['HR', 'ADMIN'])
                                    }
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      onUploadScreenshot(it.requirementId, p.key, f);
                                      e.target.value = '';
                                    }}
                                    style={{ display: 'block', marginTop: 4 }}
                                  />
                                </label>

                                <button
                                  onClick={() => onMarkPosted(it.requirementId, p.key)}
                                  disabled={
                                    String(it.jobPostingState?.status || '').toUpperCase() === 'COMPLETE' ||
                                    !uploaded ||
                                    posted ||
                                    busyUpload ||
                                    busyMark ||
                                    !allowAction_('JOBPOST_MARK_PORTAL', ['HR', 'ADMIN'])
                                  }
                                  className="hr-btn hr-btnPrimary"
                                >
                                  {busyMark ? 'Marking…' : 'Mark Posted'}
                                </button>

                                {busyUpload ? <div style={{ fontSize: 12, color: '#666' }}>Uploading…</div> : null}
                              </div>
                            );
                          })}

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                              onClick={() => onComplete(it.requirementId)}
                              disabled={
                                completingId === it.requirementId ||
                                String(it.jobPostingState?.status || '').toUpperCase() === 'COMPLETE' ||
                                !allowAction_('JOBPOST_COMPLETE', ['HR', 'ADMIN'])
                              }
                              className="hr-btn hr-btnPrimary"
                            >
                              {String(it.jobPostingState?.status || '').toUpperCase() === 'COMPLETE'
                                ? 'JobPosting Complete'
                                : completingId === it.requirementId
                                  ? 'Completing…'
                                  : 'Complete'}
                            </button>

                            <button
                              type="button"
                                onClick={() => {
                                  // Jump to candidate section (only visible when COMPLETE)
                                  const el = document.getElementById(`cand-${it.requirementId}`);
                                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                              disabled={String(it.jobPostingState?.status || '').toUpperCase() !== 'COMPLETE'}
                              className="hr-btn hr-btnMuted"
                            >
                              Add Candidate
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>Which portals posted on?</div>

                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {[
                              { key: 'NAUKRI', label: 'Naukri' },
                              { key: 'APNA', label: 'Apna' },
                              { key: 'INDEED', label: 'Indeed' },
                              { key: 'WORKINDIA', label: 'WorkIndia' },
                            ].map((p) => (
                              <label key={p.key} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(getDraft(it.requirementId)[p.key])}
                                  onChange={(e) => setDraft(it.requirementId, { [p.key]: e.target.checked })}
                                />
                                {p.label}
                              </label>
                            ))}

                            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(getDraft(it.requirementId).customEnabled)}
                                onChange={(e) => setDraft(it.requirementId, { customEnabled: e.target.checked })}
                              />
                              Custom
                            </label>

                            {getDraft(it.requirementId).customEnabled ? (
                              <input
                                value={getDraft(it.requirementId).customName}
                                onChange={(e) => setDraft(it.requirementId, { customName: e.target.value })}
                                placeholder="Custom portal name"
                                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6, minWidth: 220 }}
                              />
                            ) : null}
                          </div>

                          <button
                            onClick={() => onSetPortals(it.requirementId)}
                            className="hr-btn hr-btnPrimary"
                            disabled={!allowAction_('JOBPOST_SET_PORTALS', ['HR', 'ADMIN'])}
                          >
                            Set Portals
                          </button>
                        </div>
                      )}
                    </>
                  ) : null}

                  {String(it.jobPostingState?.status || '').toUpperCase() !== 'COMPLETE' ? (
                    <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
                      Note: "Add Candidate" and "Walk-in" will appear after JobPosting is COMPLETE.
                    </div>
                  ) : null}
                      </div>
                    ) : null}
                  </div>
                </details>

                <details
                  className="hr-section"
                  id={`cand-${it.requirementId}`}
                  open={String(it.jobPostingState?.status || '').toUpperCase() === 'COMPLETE'}
                >
                  <summary className="hr-summary">Candidates</summary>
                  <div className="hr-sectionBody">
                    {String(it.jobPostingState?.status || '').toUpperCase() === 'COMPLETE' ? (
                      <>
                        <div className="hr-candHeader">
                          <div className="hr-candTitle">
                            Candidates <span className="hr-muted">({it.candidateCount || 0})</span>
                          </div>
                          {(() => {
                            const walkinPending = (it.candidates || []).filter(
                              (c) => String(c.status || '').toUpperCase() === 'WALKIN_PENDING'
                            ).length;
                            return walkinPending ? (
                              <div className="hr-muted">Walk-in Pending: {walkinPending}</div>
                            ) : null;
                          })()}
                        </div>

                        {/* Candidates main tabs (UI-only). Default: Bulk when candidateCount=0 */}
                        {(() => {
                          const mainTab = getCandidateMainTab(it.requirementId, it.candidateCount || 0);
                          const listCount = (it.candidates || []).length;

                          return (
                            <>
                              <div className="hr-tabs" role="tablist" aria-label="Candidates">
                                <button
                                  type="button"
                                  className={"hr-tab" + (mainTab === 'ADD' ? ' isActive' : '')}
                                  onClick={() => setCandidateMainTab(it.requirementId, 'ADD')}
                                >
                                  Add Single
                                </button>
                                <button
                                  type="button"
                                  className={"hr-tab" + (mainTab === 'BULK' ? ' isActive' : '')}
                                  onClick={() => setCandidateMainTab(it.requirementId, 'BULK')}
                                >
                                  Bulk Upload
                                </button>
                                <button
                                  type="button"
                                  className={"hr-tab" + (mainTab === 'LIST' ? ' isActive' : '')}
                                  onClick={() => setCandidateMainTab(it.requirementId, 'LIST')}
                                >
                                  Candidate List ({listCount})
                                </button>
                              </div>

                              {mainTab === 'ADD' ? (
                                <div className="hr-panel">
                                  {/* UX intent: keep single-add available but not dominant for bulk */}
                                  <div className="hr-panelTitle">Add single candidate</div>
                                  <div className="hr-row">
                                    <input
                                      placeholder="Candidate Name"
                                      value={getCandidateForm(it.requirementId).candidateName}
                                      onChange={(e) => setCandidateForm(it.requirementId, { candidateName: e.target.value })}
                                      className="hr-input"
                                    />
                                    <input
                                      placeholder="Mobile Number"
                                      value={getCandidateForm(it.requirementId).mobile}
                                      onChange={(e) => setCandidateForm(it.requirementId, { mobile: e.target.value })}
                                      className="hr-input hr-inputSm"
                                    />
                                    <input
                                      placeholder="Source"
                                      value={getCandidateForm(it.requirementId).source}
                                      onChange={(e) => setCandidateForm(it.requirementId, { source: e.target.value })}
                                      className="hr-input hr-inputSm"
                                    />
                                    <label className="hr-label">
                                      Upload CV
                                      <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,image/*"
                                        disabled={!allowAction_('FILE_UPLOAD_CV', ['HR', 'ADMIN']) || !allowAction_('CANDIDATE_ADD', ['HR', 'ADMIN'])}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          setCandidateForm(it.requirementId, { file });
                                        }}
                                        style={{ display: 'block', marginTop: 4 }}
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => onAddCandidate(it.requirementId)}
                                        disabled={
                                          candidateSavingId === it.requirementId ||
                                          !allowAction_('FILE_UPLOAD_CV', ['HR', 'ADMIN']) ||
                                          !allowAction_('CANDIDATE_ADD', ['HR', 'ADMIN'])
                                        }
                                      className="hr-btn hr-btnPrimary"
                                    >
                                      {candidateSavingId === it.requirementId ? 'Saving…' : 'Add'}
                                    </button>
                                  </div>
                                  <div className="hr-muted" style={{ marginTop: 6 }}>
                                    Role auto from requirement: {it.jobRole}
                                  </div>
                                </div>
                              ) : null}

                              {mainTab === 'BULK' ? (
                                <div className="hr-panel hr-dropzone"
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const files = e.dataTransfer?.files;
                                    if (!files || files.length === 0) return;
                                    onBulkUpload(it.requirementId, files);
                                  }}
                                >
                                  {/* UX intent: make bulk upload the primary action for bulk requirements */}
                                  <div className="hr-panelTitle">Bulk upload (≤ 50)</div>
                                  <div className="hr-muted" style={{ marginBottom: 8 }}>
                                    Drag & drop files here or browse. Filename format: <span className="hr-mono">Name_Mobile_Source</span>
                                  </div>
                                  <div className="hr-row" style={{ alignItems: 'flex-end' }}>
                                    <label className="hr-label">
                                      Select files
                                      <input
                                        type="file"
                                        multiple
                                        accept=".pdf,.doc,.docx,image/*"
                                        disabled={!allowAction_('FILE_UPLOAD_CV', ['HR', 'ADMIN']) || !allowAction_('CANDIDATE_BULK_ADD', ['HR', 'ADMIN'])}
                                        onChange={(e) => {
                                          const files = e.target.files;
                                          if (!files) return;
                                          onBulkUpload(it.requirementId, files);
                                          e.target.value = '';
                                        }}
                                        style={{ display: 'block', marginTop: 4 }}
                                      />
                                    </label>
                                    <div className="hr-muted">
                                      Tip: keep sources consistent (e.g., NAUKRI / APNA).
                                    </div>
                                  </div>
                                </div>
                              ) : null}

                              {mainTab === 'LIST' ? (
                                <div className="hr-panel">
                                  <div className="hr-panelTitle">Candidate list</div>

                                  {(() => {
                            const all = it.candidates || [];
                            const shortlisting = all.filter((c) => String(c.status || '').toUpperCase() === 'NEW');
                            const hold = all.filter((c) => String(c.status || '').toUpperCase() === 'HOLD');
                            const owner = all.filter((c) => {
                              const st = String(c.status || '').toUpperCase();
                              return st === 'OWNER' || st === 'OWNER_HOLD';
                            });
                            const walkin = all.filter((c) => {
                              const st = String(c.status || '').toUpperCase();
                              return st === 'WALKIN_PENDING' || st === 'WALKIN_SCHEDULED';
                            });
                            const t = getCandidateTab(it.requirementId);
                            const shown = t === 'HOLD' ? hold : t === 'OWNER' ? owner : t === 'WALKIN' ? walkin : shortlisting;

                            function openCv(candidate) {
                              const fileId = String(candidate?.cvFileId || '').trim();
                              if (!fileId) {
                                toast.error('CV not available');
                                return;
                              }
                              const ok = openFile(fileId, token);
                              if (!ok) toast.error('Unable to open CV');
                            }

                            function toDatetimeLocalValue(isoOrDate) {
                              if (!isoOrDate) return '';
                              const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
                              if (Number.isNaN(d.getTime())) return '';
                              const pad = (n) => String(n).padStart(2, '0');
                              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                            }

                            function fmtDate(d) {
                              const pad = (n) => String(n).padStart(2, '0');
                              return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
                            }

                            function fmtTime(d) {
                              const pad = (n) => String(n).padStart(2, '0');
                              let h = d.getHours();
                              const m = d.getMinutes();
                              const ampm = h >= 12 ? 'PM' : 'AM';
                              h = h % 12;
                              if (h === 0) h = 12;
                              return `${pad(h)}:${pad(m)} ${ampm}`;
                            }

                            function buildInterviewMessage({ candidateName, jobTitle, at }) {
                              const tpl = String(interviewTemplate || '');
                              if (!tpl.trim()) return '';
                              const dateStr = fmtDate(at);
                              const timeStr = fmtTime(at);

                              const pairs = [
                                ['Candidate Name', candidateName],
                                ['Job Title', jobTitle],
                                ['Date', dateStr],
                                ['Time', timeStr],
                              ];

                              let out = tpl;
                              pairs.forEach(([k, v]) => {
                                const safe = String(v ?? '');
                                const patterns = [
                                  new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'),
                                  new RegExp(`\\[\\s*${k}\\s*\\]`, 'g'),
                                  new RegExp(`<<\\s*${k}\\s*>>`, 'g'),
                                ];
                                patterns.forEach((re) => {
                                  out = out.replace(re, safe);
                                });
                              });
                              return out;
                            }

                            function getWalkinDraft(requirementId, candidate) {
                              const key = `${requirementId}:${candidate.candidateId}`;
                              const existing = walkinDraftByKey[key];
                              if (existing) return existing;
                              return {
                                walkinAtLocal: toDatetimeLocalValue(candidate.walkinAt),
                                notes: String(candidate.walkinNotes || ''),
                              };
                            }

                            function isWalkinLocked_(candidate) {
                              // Walk-in lock condition (UI-only, HR Review page only):
                              // If a Walk-in is already saved (existing datetime/status), HR must not be able to modify it.
                              // Uses existing data only; no backend fields or API changes.
                              const st = String(candidate?.status || '').toUpperCase();
                              const hasSavedAt = Boolean(candidate && candidate.walkinAt);
                              // Status-based fallback for safety even if datetime is missing in payload.
                              return hasSavedAt || st === 'WALKIN_SCHEDULED' || st === 'WALKIN_SET';
                            }

                            function setWalkinDraft(requirementId, candidateId, patch) {
                              const key = `${requirementId}:${candidateId}`;
                              setWalkinDraftByKey((s) => ({
                                ...s,
                                [key]: { ...(s[key] || {}), ...patch },
                              }));
                            }

                            async function onSaveWalkin(requirementId, candidate) {
                              if (!allowAction_('WALKIN_SCHEDULE', ['HR', 'ADMIN'])) {
                                toast.error('Not allowed');
                                return;
                              }

                              // Failure safety: even if UI is bypassed, block client-side saves when Walk-in already exists.
                              if (isWalkinLocked_(candidate)) {
                                toast.error('Walk-in already scheduled');
                                return;
                              }

                              // Guard: only schedule after Owner approves.
                              // (Owner approval moves candidate to WALKIN_PENDING.)
                              const st = String(candidate?.status || '').toUpperCase();
                              if (st !== 'WALKIN_PENDING') {
                                toast.error('Owner approval required before scheduling');
                                return;
                              }

                              const key = `${requirementId}:${candidate.candidateId}:WALKIN_SAVE`;
                              const d = getWalkinDraft(requirementId, candidate);
                              const walkinAtLocal = String(d.walkinAtLocal || '').trim();
                              if (!walkinAtLocal) {
                                toast.error('Select date/time');
                                return;
                              }
                              const v = validateScheduleDateTimeLocal(walkinAtLocal);
                              if (!v.ok) {
                                toast.error(v.message);
                                return;
                              }
                              const dt = v.date;

                              setDecidingKey(key);
                              try {
                                await walkinSchedule(token, {
                                  requirementId,
                                  candidateId: candidate.candidateId,
                                  walkinAt: dt.toISOString(),
                                  notes: String(d.notes || ''),
                                });
                                toast.success('Walk-in scheduled');
                                await refresh(tab);
                              } catch (err) {
                                toast.error(err?.message || 'Save failed');
                              } finally {
                                setDecidingKey('');
                              }
                            }

                            function getSelectedMap(requirementId) {
                              return walkinSelectByReq[requirementId] || {};
                            }

                            function setSelected(requirementId, candidateId, checked) {
                              setWalkinSelectByReq((s) => {
                                const prev = s[requirementId] || {};
                                const next = { ...prev };
                                if (checked) next[candidateId] = true;
                                else delete next[candidateId];
                                return { ...s, [requirementId]: next };
                              });
                            }

                            function getBulkDraft(requirementId) {
                              return walkinBulkDraftByReq[requirementId] || { walkinAtLocal: '', notes: '' };
                            }

                            function setBulkDraft(requirementId, patch) {
                              setWalkinBulkDraftByReq((s) => ({
                                ...s,
                                [requirementId]: { ...getBulkDraft(requirementId), ...patch },
                              }));
                            }

                            async function onBulkApply(requirementId) {
                              if (!allowAction_('WALKIN_SCHEDULE', ['HR', 'ADMIN'])) {
                                toast.error('Not allowed');
                                return;
                              }

                              const selectedRaw = Object.keys(getSelectedMap(requirementId));
                              if (selectedRaw.length === 0) {
                                toast.error('Select candidates');
                                return;
                              }

                              // Bulk Actions Safety: never apply to candidates with Walk-in already set.
                              // Disable checkboxes in UI, and also filter here as a hard guard.
                              const all = (it && it.candidates) || [];
                              const byId = new Map(all.map((c) => [String(c.candidateId), c]));
                              const selected = selectedRaw.filter((id) => {
                                const cand = byId.get(String(id));
                                const st = String(cand?.status || '').toUpperCase();
                                return cand && st === 'WALKIN_PENDING' && !isWalkinLocked_(cand);
                              });

                              if (selected.length === 0) {
                                toast.error('Selected candidates already have Walk-in scheduled');
                                return;
                              }

                              const d = getBulkDraft(requirementId);
                              const walkinAtLocal = String(d.walkinAtLocal || '').trim();
                              if (!walkinAtLocal) {
                                toast.error('Select date/time');
                                return;
                              }

                              const v = validateScheduleDateTimeLocal(walkinAtLocal);
                              if (!v.ok) {
                                toast.error(v.message);
                                return;
                              }
                              const dt = v.date;

                              const key = `${requirementId}:WALKIN_BULK`;
                              setDecidingKey(key);
                              try {
                                const res = await walkinSchedule(token, {
                                  requirementId,
                                  candidateIds: selected,
                                  walkinAt: dt.toISOString(),
                                  notes: String(d.notes || ''),
                                });
                                const okCount = (res.updated || []).length;
                                const errCount = (res.errors || []).length;
                                if (errCount) toast.error(`Bulk scheduled: ${okCount}, errors: ${errCount}`);
                                else toast.success(`Bulk scheduled: ${okCount}`);

                                setWalkinSelectByReq((s) => ({ ...s, [requirementId]: {} }));
                                await refresh(tab);
                              } catch (err) {
                                toast.error(err?.message || 'Bulk save failed');
                              } finally {
                                setDecidingKey('');
                              }
                            }

                            async function onCopyInterview(requirementId, candidate) {
                              if (!allowAction_('COPY_TEMPLATE_DATA', ['HR', 'ADMIN'])) {
                                toast.error('Not allowed');
                                return;
                              }

                              if (!String(interviewTemplate || '').trim()) {
                                toast.error('Interview template not set (Admin → Settings)');
                                return;
                              }

                              const draft = getWalkinDraft(requirementId, candidate);
                              const atIso = candidate.walkinAt || (draft.walkinAtLocal ? new Date(draft.walkinAtLocal).toISOString() : '');
                              if (!atIso) {
                                toast.error('Set date/time first');
                                return;
                              }
                              const at = new Date(atIso);
                              if (Number.isNaN(at.getTime())) {
                                toast.error('Invalid date/time');
                                return;
                              }

                              const jobTitle = String(it.jobTitle || it.jobRole || candidate.jobRole || '').trim();
                              const msg = buildInterviewMessage({
                                candidateName: candidateDisplayName(candidate) || candidate.candidateId || '',
                                jobTitle,
                                at,
                              });
                              if (!msg) {
                                toast.error('Template empty');
                                return;
                              }
                              await navigator.clipboard.writeText(msg);
                              toast.success('Interview message copied');
                            }

                            return (
                              <>
                                <div className="hr-subTabs">
                                  <button
                                    type="button"
                                    onClick={() => setCandidateTab(it.requirementId, 'SHORTLISTING')}
                                    className={"hr-subTab" + (t === 'SHORTLISTING' ? ' isActive' : '')}
                                  >
                                    Shortlisting {shortlisting.length ? `(${shortlisting.length})` : ''}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCandidateTab(it.requirementId, 'HOLD')}
                                    className={"hr-subTab" + (t === 'HOLD' ? ' isActive' : '')}
                                  >
                                    Hold {hold.length ? `(${hold.length})` : ''}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCandidateTab(it.requirementId, 'OWNER')}
                                    className={"hr-subTab" + (t === 'OWNER' ? ' isActive' : '')}
                                  >
                                    Owner {owner.length ? `(${owner.length})` : ''}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCandidateTab(it.requirementId, 'WALKIN')}
                                    className={"hr-subTab" + (t === 'WALKIN' ? ' isActive' : '')}
                                  >
                                    Walk-in {walkin.length ? `(${walkin.length})` : ''}
                                  </button>
                                </div>

                                {shown.length === 0 ? (
                                  <div className="hr-muted">No candidates.</div>
                                ) : (
                                  <div className="hr-candScroll">
                                    {t === 'WALKIN' ? (
                                      <div className="hr-walkinPanel">
                                        <div className="hr-walkinTitle">Walk-in Scheduling</div>
                                        <div className="hr-row" style={{ alignItems: 'flex-end' }}>
                                          <div className="hr-muted">
                                            Selected: {Object.keys(getSelectedMap(it.requirementId)).length}
                                          </div>
                                          <label className="hr-label">
                                            Bulk Date/Time
                                            <input
                                              type="datetime-local"
                                              value={getBulkDraft(it.requirementId).walkinAtLocal}
                                              onChange={(e) => setBulkDraft(it.requirementId, { walkinAtLocal: e.target.value })}
                                              className="hr-input hr-inputXs"
                                            />
                                          </label>
                                          <label className="hr-label">
                                            Bulk Notes
                                            <input
                                              value={getBulkDraft(it.requirementId).notes}
                                              onChange={(e) => setBulkDraft(it.requirementId, { notes: e.target.value })}
                                              className="hr-input"
                                            />
                                          </label>
                                          <button
                                            type="button"
                                            onClick={() => onBulkApply(it.requirementId)}
                                            disabled={
                                              decidingKey === `${it.requirementId}:WALKIN_BULK` ||
                                              !allowAction_('WALKIN_SCHEDULE', ['HR', 'ADMIN'])
                                            }
                                            className="hr-btn hr-btnPrimary"
                                          >
                                            {decidingKey === `${it.requirementId}:WALKIN_BULK` ? 'Applying…' : 'Apply to Selected'}
                                          </button>
                                        </div>
                                        <div className="hr-muted" style={{ marginTop: 8 }}>
                                          Template placeholders supported: {'{{Candidate Name}}'}, {'{{Job Title}}'}, {'{{Date}}'}, {'{{Time}}'}
                                        </div>
                                      </div>
                                    ) : null}

                                    {t === 'SHORTLISTING' ? (
                                      <div className="hr-walkinPanel">
                                        <div className="hr-walkinTitle">Bulk Shortlisting</div>
                                        <div className="hr-row" style={{ alignItems: 'flex-end' }}>
                                          <div className="hr-muted">
                                            Selected: {Object.keys(getShortlistSelectedMap_(it.requirementId)).length}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setShortlistBulkDecision('OWNER_SEND');
                                              setShortlistBulkRemark('');
                                              setShortlistBulkModal({ open: true, requirementId: it.requirementId });
                                            }}
                                            disabled={!allowAction_('SHORTLIST_DECIDE', ['HR', 'ADMIN'])}
                                            className="hr-btn hr-btnPrimary"
                                          >
                                            Bulk Action
                                          </button>
                                        </div>
                                      </div>
                                    ) : null}
                                    <table className="hr-table" role="table">
                                      <thead>
                                        <tr>
                                          {t === 'WALKIN' || t === 'SHORTLISTING' ? <th style={{ width: 90 }}>Select</th> : null}
                                          <th>Candidate</th>
                                          <th style={{ width: 140 }}>Source</th>
                                          <th style={{ width: 140 }}>Status</th>
                                          <th style={{ width: 360 }}>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {shown.map((c) => {
                                          const st = String(c.status || '').toUpperCase();
                                          const holdUntilText = c.holdUntil ? new Date(c.holdUntil).toLocaleString() : '';
                                          const walkinAtText = c.walkinAt ? new Date(c.walkinAt).toLocaleString() : '';
                                          const walkinNotesText = String(c.walkinNotes || '').trim();
                                          const walkinLocked = t === 'WALKIN' ? isWalkinLocked_(c) : false;
                                          return (
                                            <tr key={c.candidateId} className="hr-rowHover">
                                              {t === 'WALKIN' ? (
                                                <td>
                                                  <label className="hr-inline">
                                                    <input
                                                      type="checkbox"
                                                      checked={Boolean(getSelectedMap(it.requirementId)[c.candidateId])}
                                                      disabled={walkinLocked}
                                                      onChange={(e) => setSelected(it.requirementId, c.candidateId, e.target.checked)}
                                                    />
                                                    <span className="hr-muted">{walkinLocked ? 'Locked' : 'Select'}</span>
                                                  </label>
                                                </td>
                                              ) : t === 'SHORTLISTING' ? (
                                                <td>
                                                  <label className="hr-inline">
                                                    <input
                                                      type="checkbox"
                                                      checked={Boolean(getShortlistSelectedMap_(it.requirementId)[c.candidateId])}
                                                      onChange={(e) => setShortlistSelected_(it.requirementId, c.candidateId, e.target.checked)}
                                                    />
                                                    <span className="hr-muted">Select</span>
                                                  </label>
                                                </td>
                                              ) : null}
                                              <td>
                                                <div style={{ fontWeight: 600 }}>
                                                  {candidateDisplayName(c) || c.candidateId}{' '}
                                                  <span className="hr-muted" style={{ fontWeight: 400 }}>
                                                    ({c.candidateId})
                                                  </span>
                                                </div>
                                                {st === 'OWNER_HOLD' ? (
                                                  <div className="hr-muted">Owner hold until: {holdUntilText || '-'}</div>
                                                ) : null}
                                                {st === 'WALKIN_PENDING' ? (
                                                  <div className="hr-muted">Walk-in pending (Owner approved)</div>
                                                ) : null}
                                                {walkinLocked ? (
                                                  <div className="hr-muted">
                                                    Walk-in already scheduled: <span className="hr-mono">{walkinAtText || '-'}</span>
                                                  </div>
                                                ) : st === 'WALKIN_PENDING' ? (
                                                  <div className="hr-muted">Walk-in pending (Owner approved)</div>
                                                ) : null}
                                                {t === 'WALKIN' && walkinNotesText ? (
                                                  <div className="hr-muted">Notes: {walkinNotesText}</div>
                                                ) : null}
                                              </td>
                                              <td>{c.source || '-'}</td>
                                              <td>
                                                <span className="hr-badge">{st || '-'}</span>
                                              </td>
                                              <td>
                                                <div className="hr-actions">
                                                  <button type="button" onClick={() => openCv(c)} className="hr-btn hr-btnSecondary">
                                                    View CV
                                                  </button>
                                                  {t === 'SHORTLISTING' ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => openDecision(it.requirementId, c)}
                                                      disabled={!allowAction_('SHORTLIST_DECIDE', ['HR', 'ADMIN'])}
                                                      className="hr-btn hr-btnPrimary"
                                                    >
                                                      Shortlisting
                                                    </button>
                                                  ) : null}

                                                  {t === 'HOLD' ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => onRevertHold(it.requirementId, c.candidateId)}
                                                      disabled={
                                                        decidingKey === `${it.requirementId}:${c.candidateId}:REVERT` ||
                                                        !allowAction_('SHORTLIST_HOLD_REVERT', ['HR', 'ADMIN'])
                                                      }
                                                      className="hr-btn hr-btnPrimary"
                                                    >
                                                      {decidingKey === `${it.requirementId}:${c.candidateId}:REVERT` ? 'Reverting…' : 'Revert'}
                                                    </button>
                                                  ) : null}

                                                  {t === 'OWNER' ? <span className="hr-muted">Locked (Owner)</span> : null}

                                                  {t === 'WALKIN' ? (
                                                    <>
                                                      <button
                                                        type="button"
                                                        onClick={() => onCopyInterview(it.requirementId, c)}
                                                        disabled={!allowAction_('COPY_TEMPLATE_DATA', ['HR', 'ADMIN'])}
                                                        className="hr-btn hr-btnSecondary"
                                                      >
                                                        Copy Message
                                                      </button>
                                                      {walkinLocked ? (
                                                        <div className="hr-muted" style={{ display: 'grid', gap: 2 }}>
                                                          <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>
                                                            Walk-in already scheduled
                                                          </div>
                                                          <div>
                                                            Date/Time: <span className="hr-mono">{walkinAtText || '-'}</span>
                                                          </div>
                                                          {walkinNotesText ? <div>Notes: {walkinNotesText}</div> : null}
                                                        </div>
                                                      ) : (
                                                        <>
                                                          <label className="hr-label" style={{ margin: 0 }}>
                                                            Date/Time
                                                            <input
                                                              type="datetime-local"
                                                              value={getWalkinDraft(it.requirementId, c).walkinAtLocal}
                                                              onChange={(e) =>
                                                                setWalkinDraft(it.requirementId, c.candidateId, { walkinAtLocal: e.target.value })
                                                              }
                                                              className="hr-input hr-inputXs"
                                                            />
                                                          </label>
                                                          <label className="hr-label" style={{ margin: 0 }}>
                                                            Notes
                                                            <input
                                                              value={getWalkinDraft(it.requirementId, c).notes}
                                                              onChange={(e) =>
                                                                setWalkinDraft(it.requirementId, c.candidateId, { notes: e.target.value })
                                                              }
                                                              className="hr-input"
                                                            />
                                                          </label>
                                                          <button
                                                            type="button"
                                                            onClick={() => onSaveWalkin(it.requirementId, c)}
                                                            disabled={
                                                              decidingKey === `${it.requirementId}:${c.candidateId}:WALKIN_SAVE` ||
                                                              !allowAction_('WALKIN_SCHEDULE', ['HR', 'ADMIN'])
                                                            }
                                                            className="hr-btn hr-btnPrimary"
                                                          >
                                                            {decidingKey === `${it.requirementId}:${c.candidateId}:WALKIN_SAVE` ? 'Saving…' : 'Save'}
                                                          </button>
                                                        </>
                                                      )}
                                                    </>
                                                  ) : null}
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="hr-muted">Candidates will appear after JobPosting is COMPLETE.</div>
                    )}
                  </div>
                </details>

                <details
                  className="hr-section"
                  open={String(it.status || '').toUpperCase() === 'SUBMITTED' || clarifyForId === it.requirementId}
                >
                  <summary className="hr-summary">Review / Actions</summary>
                  <div className="hr-sectionBody">
                    {String(it.status || '').toUpperCase() === 'SUBMITTED' ? (
                      <div className="hr-actionsRow">
                        <button
                          onClick={() => onApprove(it.requirementId)}
                          className="hr-btn hr-btnPrimary"
                          disabled={!allowAction_('REQUIREMENT_APPROVE', ['HR', 'ADMIN'])}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setClarifyForId(it.requirementId);
                            setClarifyRemark('');
                          }}
                          className="hr-btn hr-btnSecondary"
                          disabled={!allowAction_('REQUIREMENT_CLARIFICATION', ['HR', 'ADMIN'])}
                        >
                          Request Clarification
                        </button>
                      </div>
                    ) : (
                      <div className="hr-muted">No pending review actions.</div>
                    )}

                    {clarifyForId === it.requirementId ? (
                      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Clarification Remark (required)</div>
                        <textarea
                          rows={3}
                          value={clarifyRemark}
                          onChange={(e) => setClarifyRemark(e.target.value)}
                          style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
                          placeholder="Enter remark for EA"
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={onRequestClarification}
                            className="hr-btn hr-btnPrimary"
                            disabled={!allowAction_('REQUIREMENT_CLARIFICATION', ['HR', 'ADMIN'])}
                          >
                            Send
                          </button>
                          <button
                            onClick={() => {
                              setClarifyForId('');
                              setClarifyRemark('');
                            }}
                            className="hr-btn hr-btnMuted"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>
              </div>

            </div>
          ))}
        </div>
      )}

      {bulkState.open ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setBulkState((s) => ({ ...s, open: false }))}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #eee',
              padding: 14,
              width: 'min(520px, 95vw)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Bulk Upload Progress</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
              {bulkState.current}/{bulkState.total} uploaded…
            </div>
            <div style={{ height: 10, background: '#f3f3f3', borderRadius: 6, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: bulkState.total ? `${Math.round((bulkState.current / bulkState.total) * 100)}%` : '0%',
                  background: '#ddd',
                }}
              />
            </div>

            {bulkState.errors?.length ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Errors (continued processing)</div>
                <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
                  <ul style={{ margin: 0, padding: 10, fontSize: 12 }}>
                    {bulkState.errors.map((e, idx) => (
                      <li key={idx}>
                        {e.file}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setBulkState((s) => ({ ...s, open: false }))}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shortlistBulkModal.open ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 55,
          }}
          onClick={() => setShortlistBulkModal({ open: false, requirementId: '' })}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #eee',
              padding: 14,
              width: 'min(520px, 95vw)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Bulk Action</div>
            <div className="small" style={{ marginBottom: 10 }}>
              Applies to selected candidates in Shortlisting.
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <label className="small" style={{ display: 'grid', gap: 6 }}>
                Decision
                <select
                  value={shortlistBulkDecision}
                  onChange={(e) => setShortlistBulkDecision(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
                >
                  <option value="OWNER_SEND">Owner Approval</option>
                  <option value="HOLD">Hold</option>
                  <option value="REJECT">Reject</option>
                </select>
              </label>

              <label className="small" style={{ display: 'grid', gap: 6 }}>
                Remark {(String(shortlistBulkDecision).toUpperCase() === 'HOLD' || String(shortlistBulkDecision).toUpperCase() === 'REJECT') ? '(required)' : '(optional)'}
                <textarea
                  rows={3}
                  value={shortlistBulkRemark}
                  onChange={(e) => setShortlistBulkRemark(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
                  placeholder="Enter remark..."
                />
              </label>
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShortlistBulkModal({ open: false, requirementId: '' })}
                className="hr-btn hr-btnMuted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onBulkShortlistApply_(shortlistBulkModal.requirementId)}
                className="hr-btn hr-btnPrimary"
                disabled={
                  !allowAction_('SHORTLIST_DECIDE', ['HR', 'ADMIN']) ||
                  (String(shortlistBulkDecision || '').toUpperCase() === 'OWNER_SEND' &&
                    !allowUi_('BTN_SHORTLIST_OWNER_SEND', ['HR', 'ADMIN']))
                }
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shortlistBulkState.open ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 56,
          }}
          onClick={() => setShortlistBulkState((s) => ({ ...s, open: false }))}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #eee',
              padding: 14,
              width: 'min(520px, 95vw)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Bulk Shortlisting Progress</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
              {shortlistBulkState.current}/{shortlistBulkState.total} processed…
            </div>
            <div style={{ height: 10, background: '#f3f3f3', borderRadius: 6, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: shortlistBulkState.total ? `${Math.round((shortlistBulkState.current / shortlistBulkState.total) * 100)}%` : '0%',
                  background: '#ddd',
                }}
              />
            </div>

            {shortlistBulkState.errors?.length ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Errors (continued processing)</div>
                <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
                  <ul style={{ margin: 0, padding: 10, fontSize: 12 }}>
                    {shortlistBulkState.errors.map((e, idx) => (
                      <li key={idx}>
                        {e.file}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShortlistBulkState((s) => ({ ...s, open: false }))}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {decisionModal.open ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 60,
          }}
          onClick={() => setDecisionModal({ open: false, requirementId: '', candidate: null })}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #eee',
              padding: 14,
              width: 'min(520px, 95vw)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Shortlisting</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
              {candidateDisplayName(decisionModal.candidate) || decisionModal.candidate?.candidateId} ({decisionModal.candidate?.candidateId})
            </div>

            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
              Remark required for Reject/Hold
            </div>
            <textarea
              rows={3}
              value={decisionRemark}
              onChange={(e) => setDecisionRemark(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              placeholder="Enter remark"
            />

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => onDecide('OWNER_SEND')}
                disabled={
                  decidingKey === `${decisionModal.requirementId}:${decisionModal.candidate?.candidateId}:OWNER_SEND` ||
                  !allowAction_('SHORTLIST_DECIDE', ['HR', 'ADMIN']) ||
                  !allowUi_('BTN_SHORTLIST_OWNER_SEND', ['HR', 'ADMIN'])
                }
                style={{
                  padding: '6px 10px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Owner Approval
              </button>
              <button
                type="button"
                onClick={() => onDecide('HOLD')}
                disabled={
                  decidingKey === `${decisionModal.requirementId}:${decisionModal.candidate?.candidateId}:HOLD` ||
                  !allowAction_('SHORTLIST_DECIDE', ['HR', 'ADMIN'])
                }
                style={{
                  padding: '6px 10px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Hold
              </button>
              <button
                type="button"
                onClick={() => onDecide('REJECT')}
                disabled={
                  decidingKey === `${decisionModal.requirementId}:${decisionModal.candidate?.candidateId}:REJECT` ||
                  !allowAction_('SHORTLIST_DECIDE', ['HR', 'ADMIN'])
                }
                style={{
                  padding: '6px 10px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => setDecisionModal({ open: false, requirementId: '', candidate: null })}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
