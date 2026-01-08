import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { useAuth } from '../auth/useAuth';
import { ApiError } from '../api/client';
import {
  logsQuery,
  permissionsList,
  permissionsUpsert,
  rolesList,
  rolesUpsert,
  settingsGet,
  settingsUpsert,
  templateList,
  templateUpsert,
  usersList,
  usersUpsert,
} from '../api/admin';
import { autoRejectFinalNoshow } from '../api/candidates';
import { AdminTrainingForm } from '../components/training/AdminTrainingForm';
import { safeActorLabel } from '../utils/pii';

function toastErrorOnce_(key, message) {
  toast.error(message, { id: key });
}

function errorMessage_(err, fallback) {
  if (err instanceof ApiError) return err.message || fallback;
  return err?.message ?? fallback;
}

function asDateInputValue(d) {
  if (!d) return '';
  const dt = new Date(d);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AdminPage() {
  const navigate = useNavigate();
  const { token, role } = useAuth();

  const tabs = useMemo(
    () => [
      { key: 'users', label: 'Users' },
      { key: 'roles', label: 'Roles' },
      { key: 'permissions', label: 'Permissions' },
      { key: 'templates', label: 'Job Templates' },
      { key: 'trainings', label: 'Trainings' },
      { key: 'settings', label: 'Settings' },
      { key: 'logs', label: 'Logs' },
    ],
    []
  );

  const [active, setActive] = useState('users');

  // Users state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', fullName: '', role: 'EA', active: true });

  // Roles state (dynamic)
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleForm, setRoleForm] = useState({ roleCode: '', roleName: '', status: 'ACTIVE' });

  // Permissions state (dynamic)
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permTypeFilter, setPermTypeFilter] = useState('');
  const [permQ, setPermQ] = useState('');
  const [permForm, setPermForm] = useState({ permType: 'UI', permKey: '', rolesCsv: '', enabled: true });

  // One-click assignment helpers
  const [permRole, setPermRole] = useState('');
  const [permQuickBusy, setPermQuickBusy] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [tplForm, setTplForm] = useState({
    templateId: null,
    jobRole: '',
    jobTitle: '',
    jd: '',
    responsibilities: '',
    skills: '',
    shift: '',
    payScale: '',
    perks: '',
    notes: '',
    active: true,
  });

  // Settings state
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [finalNoshowRunning, setFinalNoshowRunning] = useState(false);
  const [passingMarks, setPassingMarks] = useState(6);
  const [notPickThreshold, setNotPickThreshold] = useState(3);
  const [interviewMessageTemplate, setInterviewMessageTemplate] = useState('');

  // Logs state
  const [logsLoading, setLogsLoading] = useState(false);
  const [logType, setLogType] = useState('AUDIT');
  const [logFrom, setLogFrom] = useState(asDateInputValue(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [logTo, setLogTo] = useState(asDateInputValue(new Date()));
  const [stageTag, setStageTag] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [requirementId, setRequirementId] = useState('');
  const [logs, setLogs] = useState([]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await usersList(token, { page: 1, pageSize: 500 });
      setUsers(res.items ?? []);
    } catch (e) {
      toastErrorOnce_('admin_users_load', errorMessage_(e, 'Failed to load users'));
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const res = await rolesList(token, { includeInactive: true });
      setRoles(res.items ?? []);
    } catch (e) {
      toastErrorOnce_('admin_roles_load', errorMessage_(e, 'Failed to load roles'));
    } finally {
      setRolesLoading(false);
    }
  }, [token]);

  const loadPermissions = useCallback(async () => {
    setPermissionsLoading(true);
    try {
      const res = await permissionsList(token);
      setPermissions(res.items ?? []);
    } catch (e) {
      toastErrorOnce_('admin_permissions_load', errorMessage_(e, 'Failed to load permissions'));
    } finally {
      setPermissionsLoading(false);
    }
  }, [token]);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await templateList(token, { page: 1, pageSize: 500 });
      setTemplates(res.items ?? []);
    } catch (e) {
      toastErrorOnce_('admin_templates_load', errorMessage_(e, 'Failed to load templates'));
    } finally {
      setTemplatesLoading(false);
    }
  }, [token]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await settingsGet(token);
      const items = res.items ?? [];
      const pm = items.find((x) => x.key === 'PASSING_MARKS');
      const np = items.find((x) => x.key === 'NOT_PICK_THRESHOLD');
      const im = items.find((x) => x.key === 'INTERVIEW_MESSAGE_TEMPLATE');
      if (pm) setPassingMarks(Number(pm.value ?? 6));
      if (np) setNotPickThreshold(Number(np.value ?? 3));
      if (im) setInterviewMessageTemplate(String(im.value ?? ''));
    } catch (e) {
      toastErrorOnce_('admin_settings_load', errorMessage_(e, 'Failed to load settings'));
    } finally {
      setSettingsLoading(false);
    }
  }, [token]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await logsQuery(token, {
        logType,
        from: logFrom ? new Date(logFrom).toISOString() : null,
        to: logTo ? new Date(logTo + 'T23:59:59').toISOString() : null,
        stageTag: stageTag || null,
        actorRole: actorRole || null,
        entityType: entityType || null,
        entityId: entityId || null,
        candidateId: candidateId || null,
        requirementId: requirementId || null,
        page: 1,
        pageSize: 200,
      });
      setLogs(res.items ?? []);
    } catch (e) {
      toastErrorOnce_('admin_logs_load', errorMessage_(e, 'Failed to load logs'));
    } finally {
      setLogsLoading(false);
    }
  }, [token, logType, logFrom, logTo, stageTag, actorRole, entityType, entityId, candidateId, requirementId]);

  useEffect(() => {
    if (active === 'users') loadUsers();
    if (active === 'users') loadRoles();
    if (active === 'roles') loadRoles();
    if (active === 'permissions') {
      loadRoles();
      loadPermissions();
    }
    if (active === 'templates') loadTemplates();
    if (active === 'settings') loadSettings();
    if (active === 'logs') loadLogs();
  }, [active, loadUsers, loadRoles, loadPermissions, loadTemplates, loadSettings, loadLogs]);

  const roleOptions = useMemo(() => {
    const items = Array.isArray(roles) ? roles : [];
    const activeOnly = items.filter((r) => String(r.status || '').toUpperCase() === 'ACTIVE');
    const codes = activeOnly.map((r) => String(r.roleCode || '').toUpperCase()).filter(Boolean);
    if (codes.length) return codes.sort();
    return ['ADMIN', 'EA', 'HR', 'OWNER'];
  }, [roles]);

  const rolesIndex = useMemo(() => {
    const out = {};
    for (const r of roles || []) out[String(r.roleCode || '').toUpperCase()] = r;
    return out;
  }, [roles]);

  const filteredPermissions = useMemo(() => {
    const list = Array.isArray(permissions) ? permissions : [];
    const pt = String(permTypeFilter || '').toUpperCase().trim();
    const q = String(permQ || '').toUpperCase().trim();
    return list.filter((p) => {
      if (pt && String(p.permType || '').toUpperCase() !== pt) return false;
      if (q) {
        const hay = `${p.permType || ''}:${p.permKey || ''}:${p.rolesCsv || ''}`.toUpperCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [permissions, permTypeFilter, permQ]);

  function parseRolesCsv_(s) {
    return String(s || '')
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
  }

  function joinRolesCsv_(roles) {
    const uniq = Array.from(new Set((roles || []).map((x) => String(x || '').trim().toUpperCase()).filter(Boolean)));
    uniq.sort();
    return uniq.join(',');
  }

  function roleHas_(rolesCsv, roleCode) {
    if (!roleCode) return false;
    return parseRolesCsv_(rolesCsv).includes(String(roleCode).toUpperCase());
  }

  function addRole_(rolesCsv, roleCode) {
    const roles = parseRolesCsv_(rolesCsv);
    roles.push(String(roleCode).toUpperCase());
    return joinRolesCsv_(roles);
  }

  function removeRole_(rolesCsv, roleCode) {
    const rc = String(roleCode || '').toUpperCase();
    const roles = parseRolesCsv_(rolesCsv).filter((x) => x !== rc);
    return joinRolesCsv_(roles);
  }

  async function upsertPermissionsChunked_(items) {
    const list = Array.isArray(items) ? items : [];
    const CHUNK = 200;
    for (let i = 0; i < list.length; i += CHUNK) {
      // eslint-disable-next-line no-await-in-loop
      await permissionsUpsert(token, list.slice(i, i + CHUNK));
    }
  }

  async function onToggleRolePermission(p, roleCode, nextChecked) {
    const rc = String(roleCode || '').toUpperCase().trim();
    if (!rc) return;
    setPermQuickBusy(true);
    try {
      const nextRolesCsv = nextChecked ? addRole_(p.rolesCsv, rc) : removeRole_(p.rolesCsv, rc);
      await permissionsUpsert(token, [
        {
          permType: String(p.permType || '').toUpperCase(),
          permKey: String(p.permKey || '').toUpperCase(),
          rolesCsv: nextRolesCsv,
          enabled: !!p.enabled,
        },
      ]);
      await loadPermissions();
    } catch (e) {
      toastErrorOnce_('admin_perm_quick_toggle', errorMessage_(e, 'Failed to update permission'));
    } finally {
      setPermQuickBusy(false);
    }
  }

  async function onPresetMisExcelOnly() {
    setPermQuickBusy(true);
    try {
      // 1) Ensure MIS role exists
      await rolesUpsert(token, { roleCode: 'MIS', roleName: 'MIS', status: 'ACTIVE' });
      await loadRoles();

      // 2) Remove MIS from any existing rules (so it becomes minimal access)
      const current = Array.isArray(permissions) ? permissions : [];
      const toUpdate = [];
      for (const p of current) {
        if (!roleHas_(p.rolesCsv, 'MIS')) continue;
        toUpdate.push({
          permType: String(p.permType || '').toUpperCase(),
          permKey: String(p.permKey || '').toUpperCase(),
          rolesCsv: removeRole_(p.rolesCsv, 'MIS'),
          enabled: !!p.enabled,
        });
      }
      if (toUpdate.length) await upsertPermissionsChunked_(toUpdate);

      // 3) Add MIS to only the required permissions
      // - PORTAL_TESTS: allow opening the tests module
      // - TESTS_QUEUE_LIST: allow loading queue
      // - CANDIDATE_TEST_SUBMIT: allow submitting marks (Excel via TestMaster fillRoles)
      await upsertPermissionsChunked_([
        { permType: 'UI', permKey: 'PORTAL_TESTS', rolesCsv: addRole_('', 'MIS'), enabled: true },
        { permType: 'ACTION', permKey: 'TESTS_QUEUE_LIST', rolesCsv: addRole_('', 'MIS'), enabled: true },
        { permType: 'ACTION', permKey: 'CANDIDATE_TEST_SUBMIT', rolesCsv: addRole_('', 'MIS'), enabled: true },
      ]);

      await loadPermissions();
      toast.success('MIS preset applied (Excel only)');
    } catch (e) {
      toastErrorOnce_('admin_perm_preset_mis', errorMessage_(e, 'Failed to apply MIS preset'));
    } finally {
      setPermQuickBusy(false);
    }
  }

  async function onGrantAllPortals(roleCode) {
    const rc = String(roleCode || '').toUpperCase().trim();
    if (!rc) return;
    setPermQuickBusy(true);
    try {
      const current = Array.isArray(permissions) ? permissions : [];
      const portalRules = current.filter((p) => String(p.permType || '').toUpperCase() === 'UI' && String(p.permKey || '').toUpperCase().startsWith('PORTAL_'));
      const toUpdate = portalRules
        .filter((p) => !roleHas_(p.rolesCsv, rc))
        .map((p) => ({
          permType: 'UI',
          permKey: String(p.permKey || '').toUpperCase(),
          rolesCsv: addRole_(p.rolesCsv, rc),
          enabled: !!p.enabled,
        }));
      if (toUpdate.length) await upsertPermissionsChunked_(toUpdate);
      await loadPermissions();
      toast.success('Portals granted');
    } catch (e) {
      toastErrorOnce_('admin_perm_grant_portals', errorMessage_(e, 'Failed to grant portals'));
    } finally {
      setPermQuickBusy(false);
    }
  }

  async function onRevokeAllPortals(roleCode) {
    const rc = String(roleCode || '').toUpperCase().trim();
    if (!rc) return;
    setPermQuickBusy(true);
    try {
      const current = Array.isArray(permissions) ? permissions : [];
      const portalRules = current.filter((p) => String(p.permType || '').toUpperCase() === 'UI' && String(p.permKey || '').toUpperCase().startsWith('PORTAL_'));
      const toUpdate = portalRules
        .filter((p) => roleHas_(p.rolesCsv, rc))
        .map((p) => ({
          permType: 'UI',
          permKey: String(p.permKey || '').toUpperCase(),
          rolesCsv: removeRole_(p.rolesCsv, rc),
          enabled: !!p.enabled,
        }));
      if (toUpdate.length) await upsertPermissionsChunked_(toUpdate);
      await loadPermissions();
      toast.success('Portals revoked');
    } catch (e) {
      toastErrorOnce_('admin_perm_revoke_portals', errorMessage_(e, 'Failed to revoke portals'));
    } finally {
      setPermQuickBusy(false);
    }
  }

  async function onSaveUser(e) {
    e.preventDefault();
    if (!userForm.email || !userForm.role) return;

    try {
      await usersUpsert(token, userForm);
      toast.success('User saved');
      setUserForm({ email: '', fullName: '', role: 'EA', active: true });
      await loadUsers();
    } catch (err) {
      toastErrorOnce_('admin_user_save', errorMessage_(err, 'Failed to save user'));
    }
  }

  async function onSaveRole(e) {
    e.preventDefault();
    const roleCode = String(roleForm.roleCode || '').toUpperCase().trim();
    if (!roleCode) return;

    try {
      await rolesUpsert(token, {
        roleCode,
        roleName: String(roleForm.roleName || '').trim() || roleCode,
        status: String(roleForm.status || 'ACTIVE').toUpperCase().trim(),
      });
      toast.success('Role saved');
      setRoleForm({ roleCode: '', roleName: '', status: 'ACTIVE' });
      await loadRoles();
    } catch (err) {
      toastErrorOnce_('admin_role_save', errorMessage_(err, 'Failed to save role'));
    }
  }

  async function onSavePermission(e) {
    e.preventDefault();
    const permType = String(permForm.permType || '').toUpperCase().trim();
    const permKey = String(permForm.permKey || '').toUpperCase().trim();
    const rolesCsv = String(permForm.rolesCsv || '').trim();
    const enabled = !!permForm.enabled;

    if (!permType || !permKey) return;
    if (permType !== 'ACTION' && permType !== 'UI') {
      toast.error('permType must be ACTION or UI');
      return;
    }

    try {
      await permissionsUpsert(token, [{ permType, permKey, rolesCsv, enabled }]);
      toast.success('Permission saved');
      setPermForm({ permType: 'UI', permKey: '', rolesCsv: '', enabled: true });
      await loadPermissions();
    } catch (err) {
      toastErrorOnce_('admin_permission_save', errorMessage_(err, 'Failed to save permission'));
    }
  }

  async function onSaveTemplate(e) {
    e.preventDefault();
    if (!tplForm.jobRole || !tplForm.jobTitle) return;

    try {
      await templateUpsert(token, tplForm);
      toast.success('Template saved');
      setTplForm({
        templateId: null,
        jobRole: '',
        jobTitle: '',
        jd: '',
        responsibilities: '',
        skills: '',
        shift: '',
        payScale: '',
        perks: '',
        notes: '',
        active: true,
      });
      await loadTemplates();
    } catch (err) {
      toastErrorOnce_('admin_template_save', errorMessage_(err, 'Failed to save template'));
    }
  }

  async function onSaveSettings(e) {
    e.preventDefault();

    const pm = Number(passingMarks);
    const np = Number(notPickThreshold);
    if (!Number.isFinite(pm) || pm < 0 || pm > 10) {
      toast.error('Passing marks must be 0–10');
      return;
    }
    if (!Number.isFinite(np) || np < 0 || np > 10) {
      toast.error('NotPick threshold must be 0–10');
      return;
    }

    try {
      await settingsUpsert(token, [
        { key: 'PASSING_MARKS', value: pm, type: 'number', scope: 'GLOBAL' },
        { key: 'NOT_PICK_THRESHOLD', value: np, type: 'number', scope: 'GLOBAL' },
        { key: 'INTERVIEW_MESSAGE_TEMPLATE', value: String(interviewMessageTemplate || ''), type: 'string', scope: 'GLOBAL' },
      ]);
      toast.success('Settings saved');
      await loadSettings();
    } catch (err) {
      toastErrorOnce_('admin_settings_save', errorMessage_(err, 'Failed to save settings'));
    }
  }

  async function onRunFinalNoshow() {
    setFinalNoshowRunning(true);
    try {
      const res = await autoRejectFinalNoshow(token);
      toast.success(`Final Hold no-show auto reject done (rejected: ${res.rejected ?? 0})`);
    } catch (e) {
      toastErrorOnce_('admin_final_noshow', errorMessage_(e, 'Failed to run Final Hold no-show auto reject'));
    } finally {
      setFinalNoshowRunning(false);
    }
  }

  return (
    <AppLayout>
      <div className="card">
        {role === 'ADMIN' ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="button" type="button" onClick={() => navigate('/dashboard')}>
              Open Dashboard
            </button>
            <button className="button" type="button" onClick={() => navigate('/hr/review')}>
              Open HR Portal
            </button>
            <button className="button" type="button" onClick={() => navigate('/owner')}>
              Open Owner Portal
            </button>
            <button className="button" type="button" onClick={() => navigate('/tests')}>
              Open Tests
            </button>
          </div>
        ) : null}
        <div className="row">
          <h2 style={{ margin: 0 }}>Admin</h2>
          <div className="spacer" />
          <button className="button" onClick={() => navigate('/dashboard')}>Back</button>
        </div>

        <div style={{ height: 12 }} />
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

      <div style={{ height: 12 }} />

      {active === 'users' ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>User Management</h3>

          <form onSubmit={onSaveUser} className="card" style={{ background: '#fafafa' }}>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <input
                placeholder="Email"
                value={userForm.email}
                onChange={(e) => setUserForm((s) => ({ ...s, email: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 260 }}
              />
              <input
                placeholder="Full name"
                value={userForm.fullName}
                onChange={(e) => setUserForm((s) => ({ ...s, fullName: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 220 }}
              />
              <select
                value={userForm.role}
                onChange={(e) => setUserForm((s) => ({ ...s, role: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={userForm.active}
                  onChange={(e) => setUserForm((s) => ({ ...s, active: e.target.checked }))}
                />
                Active
              </label>
              <button className="button primary" type="submit" disabled={!userForm.email || !userForm.role}>
                Save
              </button>
              <button
                className="button"
                type="button"
                onClick={() => setUserForm({ email: '', fullName: '', role: 'EA', active: true })}
              >
                Clear
              </button>
            </div>
          </form>

          <div style={{ height: 12 }} />
          <div className="small">{usersLoading ? 'Loading…' : `${users.length} users`}</div>

          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th align="left">Email</th>
                  <th align="left">Name</th>
                  <th align="left">Role</th>
                  <th align="left">Status</th>
                  <th align="left">Last Login</th>
                  <th align="left">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} style={{ borderTop: '1px solid #eee' }}>
                    <td>{u.email}</td>
                    <td>{u.fullName}</td>
                    <td>{u.role}</td>
                    <td>{u.status}</td>
                    <td className="small">{u.lastLoginAt ? String(u.lastLoginAt) : '-'}</td>
                    <td>
                      <button
                        className="button"
                        type="button"
                        onClick={() =>
                          setUserForm({
                            email: u.email,
                            fullName: u.fullName,
                            role: u.role,
                            active: String(u.status).toUpperCase() === 'ACTIVE',
                          })
                        }
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {active === 'roles' ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Roles</h3>
          <div className="small" style={{ marginBottom: 10 }}>
            Create/update roles. New roles can log in when status is ACTIVE.
          </div>

          <form onSubmit={onSaveRole} className="card" style={{ background: '#fafafa' }}>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <input
                placeholder="roleCode (e.g., MIS)"
                value={roleForm.roleCode}
                onChange={(e) => setRoleForm((s) => ({ ...s, roleCode: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 220 }}
              />
              <input
                placeholder="roleName (display)"
                value={roleForm.roleName}
                onChange={(e) => setRoleForm((s) => ({ ...s, roleName: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 240 }}
              />
              <select
                value={roleForm.status}
                onChange={(e) => setRoleForm((s) => ({ ...s, status: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
              <button className="button primary" type="submit" disabled={!roleForm.roleCode}>
                Save
              </button>
              <button
                className="button"
                type="button"
                onClick={() => setRoleForm({ roleCode: '', roleName: '', status: 'ACTIVE' })}
              >
                Clear
              </button>
              <button className="button" type="button" onClick={loadRoles} disabled={rolesLoading}>
                {rolesLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </form>

          <div style={{ height: 12 }} />
          <div className="small">{rolesLoading ? 'Loading…' : `${(roles || []).length} roles`}</div>

          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th align="left">roleCode</th>
                  <th align="left">roleName</th>
                  <th align="left">status</th>
                  <th align="left">updatedAt</th>
                  <th align="left">updatedBy</th>
                  <th align="left">Action</th>
                </tr>
              </thead>
              <tbody>
                {(roles || []).map((r) => (
                  <tr key={r.roleCode} style={{ borderTop: '1px solid #eee' }}>
                    <td>{r.roleCode}</td>
                    <td>{r.roleName || '-'}</td>
                    <td>{r.status}</td>
                    <td className="small">{r.updatedAt ? String(r.updatedAt) : '-'}</td>
                    <td className="small">{safeActorLabel(r.updatedBy) || '-'}</td>
                    <td>
                      <button
                        className="button"
                        type="button"
                        onClick={() =>
                          setRoleForm({
                            roleCode: r.roleCode,
                            roleName: r.roleName || '',
                            status: String(r.status || 'ACTIVE').toUpperCase(),
                          })
                        }
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {active === 'trainings' ? (
        <AdminTrainingForm token={token} />
      ) : null}

      {active === 'permissions' ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Permissions</h3>
          <div className="small" style={{ marginBottom: 10 }}>
            Manage ACTION/UI permissions (comma-separated roles). UI keys prefixed with PORTAL_ control portal access.
          </div>

          <div className="card" style={{ background: '#fafafa', marginBottom: 12 }}>
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={permRole}
                onChange={(e) => setPermRole(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
              >
                <option value="">Quick assign role (optional)</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button className="button" type="button" disabled={!permRole || permQuickBusy} onClick={() => onGrantAllPortals(permRole)}>
                Grant all portals
              </button>
              <button className="button" type="button" disabled={!permRole || permQuickBusy} onClick={() => onRevokeAllPortals(permRole)}>
                Revoke all portals
              </button>
              <div className="spacer" />
              <button className="button" type="button" disabled={permQuickBusy} onClick={onPresetMisExcelOnly}>
                One-click: MIS (Excel only)
              </button>
            </div>
            <div className="small" style={{ marginTop: 6, color: '#666' }}>
              With a role selected, click the checkbox in the table to grant/revoke that permission for the role (auto-saves).
            </div>
          </div>

          <form onSubmit={onSavePermission} className="card" style={{ background: '#fafafa' }}>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <select
                value={permForm.permType}
                onChange={(e) => setPermForm((s) => ({ ...s, permType: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
              >
                <option value="UI">UI</option>
                <option value="ACTION">ACTION</option>
              </select>
              <input
                placeholder="permKey (e.g., PORTAL_HR_REVIEW)"
                value={permForm.permKey}
                onChange={(e) => setPermForm((s) => ({ ...s, permKey: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 320 }}
              />
              <input
                placeholder="rolesCsv (e.g., ADMIN,HR)"
                value={permForm.rolesCsv}
                onChange={(e) => setPermForm((s) => ({ ...s, rolesCsv: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 320 }}
              />
              <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={!!permForm.enabled}
                  onChange={(e) => setPermForm((s) => ({ ...s, enabled: e.target.checked }))}
                />
                Enabled
              </label>
              <button className="button primary" type="submit" disabled={!permForm.permType || !permForm.permKey}>
                Save
              </button>
              <button
                className="button"
                type="button"
                onClick={() => setPermForm({ permType: 'UI', permKey: '', rolesCsv: '', enabled: true })}
              >
                Clear
              </button>
              <button className="button" type="button" onClick={loadPermissions} disabled={permissionsLoading}>
                {permissionsLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </form>

          <div style={{ height: 12 }} />

          <div className="card" style={{ background: '#fafafa' }}>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <select
                value={permTypeFilter}
                onChange={(e) => setPermTypeFilter(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
              >
                <option value="">All types</option>
                <option value="UI">UI</option>
                <option value="ACTION">ACTION</option>
              </select>
              <input
                placeholder="Search (optional)"
                value={permQ}
                onChange={(e) => setPermQ(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 260 }}
              />
              <div className="spacer" />
              <div className="small">{permissionsLoading ? 'Loading…' : `${filteredPermissions.length} rules`}</div>
            </div>
          </div>

          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th align="left">Type</th>
                  <th align="left">Key</th>
                  <th align="left">Enabled</th>
                  <th align="left">Roles</th>
                  <th align="left">updatedAt</th>
                  <th align="left">updatedBy</th>
                  <th align="left">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map((p) => (
                  <tr key={`${p.permType}:${p.permKey}`} style={{ borderTop: '1px solid #eee' }}>
                    <td>{p.permType}</td>
                    <td className="small">{p.permKey}</td>
                    <td>{p.enabled ? 'TRUE' : 'FALSE'}</td>
                    <td className="small">
                      {p.rolesCsv || '-'}
                    </td>
                    <td className="small">{p.updatedAt ? String(p.updatedAt) : '-'}</td>
                    <td className="small">{safeActorLabel(p.updatedBy) || '-'}</td>
                    <td>
                      {permRole ? (
                        <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={roleHas_(p.rolesCsv, permRole)}
                            disabled={permQuickBusy}
                            onChange={(e) => onToggleRolePermission(p, permRole, e.target.checked)}
                          />
                          Allow
                        </label>
                      ) : null}
                      <button
                        className="button"
                        type="button"
                        onClick={() =>
                          setPermForm({
                            permType: String(p.permType || 'UI').toUpperCase(),
                            permKey: p.permKey,
                            rolesCsv: p.rolesCsv || '',
                            enabled: !!p.enabled,
                          })
                        }
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ height: 8 }} />
          <div className="small" style={{ color: '#666' }}>
            Tip: rolesCsv uses role codes (e.g., ADMIN,HR,MIS). To disable a permission for everyone, uncheck Enabled.
          </div>
        </div>
      ) : null}

      {active === 'settings' ? (
        <div className="card" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Manual Actions</h3>
          <div className="small" style={{ marginBottom: 10 }}>
            Run system actions manually (admin-only).
          </div>

          <div className="row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <button className="button" type="button" onClick={onRunFinalNoshow} disabled={finalNoshowRunning}>
              {finalNoshowRunning ? 'Running…' : 'Run Final Hold No-show Auto Reject'}
            </button>
          </div>
        </div>
      ) : null}

      {active === 'templates' ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Job Templates</h3>

          <form onSubmit={onSaveTemplate} className="card" style={{ background: '#fafafa' }}>
            <div className="small" style={{ marginBottom: 8 }}>
              Create/update templates by Job Role (CRM, MIS, Jr Accountant, …)
            </div>

            <div className="row" style={{ flexWrap: 'wrap' }}>
              <input
                placeholder="Job Role (key)"
                value={tplForm.jobRole}
                onChange={(e) => setTplForm((s) => ({ ...s, jobRole: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 220 }}
              />
              <input
                placeholder="Job Title"
                value={tplForm.jobTitle}
                onChange={(e) => setTplForm((s) => ({ ...s, jobTitle: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 240 }}
              />
              <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={tplForm.active}
                  onChange={(e) => setTplForm((s) => ({ ...s, active: e.target.checked }))}
                />
                Active
              </label>
              <button className="button primary" type="submit" disabled={!tplForm.jobRole || !tplForm.jobTitle}>
                Save
              </button>
              <button
                className="button"
                type="button"
                onClick={() =>
                  setTplForm({
                    templateId: null,
                    jobRole: '',
                    jobTitle: '',
                    jd: '',
                    responsibilities: '',
                    skills: '',
                    shift: '',
                    payScale: '',
                    perks: '',
                    notes: '',
                    active: true,
                  })
                }
              >
                New
              </button>
            </div>

            <div style={{ height: 10 }} />

            <textarea
              placeholder="JD"
              value={tplForm.jd}
              onChange={(e) => setTplForm((s) => ({ ...s, jd: e.target.value }))}
              rows={4}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
            />
            <div style={{ height: 8 }} />
            <textarea
              placeholder="Responsibilities"
              value={tplForm.responsibilities}
              onChange={(e) => setTplForm((s) => ({ ...s, responsibilities: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
            />
            <div style={{ height: 8 }} />
            <textarea
              placeholder="Skills"
              value={tplForm.skills}
              onChange={(e) => setTplForm((s) => ({ ...s, skills: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
            />
            <div style={{ height: 8 }} />

            <div className="row" style={{ flexWrap: 'wrap' }}>
              <input
                placeholder="Shift"
                value={tplForm.shift}
                onChange={(e) => setTplForm((s) => ({ ...s, shift: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 180 }}
              />
              <input
                placeholder="Pay scale"
                value={tplForm.payScale}
                onChange={(e) => setTplForm((s) => ({ ...s, payScale: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 180 }}
              />
              <input
                placeholder="Perks"
                value={tplForm.perks}
                onChange={(e) => setTplForm((s) => ({ ...s, perks: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 180 }}
              />
            </div>
            <div style={{ height: 8 }} />
            <textarea
              placeholder="Notes"
              value={tplForm.notes}
              onChange={(e) => setTplForm((s) => ({ ...s, notes: e.target.value }))}
              rows={2}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
            />
          </form>

          <div style={{ height: 12 }} />
          <div className="small">{templatesLoading ? 'Loading…' : `${templates.length} templates`}</div>

          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th align="left">Job Role</th>
                  <th align="left">Job Title</th>
                  <th align="left">Status</th>
                  <th align="left">Action</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.templateId} style={{ borderTop: '1px solid #eee' }}>
                    <td>{t.jobRole}</td>
                    <td>{t.jobTitle}</td>
                    <td>{t.status}</td>
                    <td>
                      <button
                        className="button"
                        type="button"
                        onClick={() =>
                          setTplForm({
                            templateId: t.templateId,
                            jobRole: t.jobRole,
                            jobTitle: t.jobTitle,
                            jd: t.jd,
                            responsibilities: t.responsibilities,
                            skills: t.skills,
                            shift: t.shift,
                            payScale: t.payScale,
                            perks: t.perks,
                            notes: t.notes,
                            active: String(t.status).toUpperCase() === 'ACTIVE',
                          })
                        }
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {active === 'settings' ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Settings</h3>
          <div className="small">Global thresholds (server-enforced later in pipeline)</div>

          <form onSubmit={onSaveSettings} className="card" style={{ marginTop: 12, background: '#fafafa' }}>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <label className="small" style={{ display: 'grid', gap: 6 }}>
                Passing marks (default 6/10)
                <input
                  type="number"
                  value={passingMarks}
                  onChange={(e) => setPassingMarks(e.target.value)}
                  min={0}
                  max={10}
                  step={1}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', width: 180 }}
                />
              </label>
              <label className="small" style={{ display: 'grid', gap: 6 }}>
                NotPick threshold (default 3)
                <input
                  type="number"
                  value={notPickThreshold}
                  onChange={(e) => setNotPickThreshold(e.target.value)}
                  min={0}
                  max={10}
                  step={1}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', width: 180 }}
                />
              </label>
              <label className="small" style={{ display: 'grid', gap: 6, minWidth: 420, flex: '1 1 420px' }}>
                Interview Message Template
                <span style={{ color: '#666' }}>
                  Use placeholders: {'{{Candidate Name}}'}, {'{{Job Title}}'}, {'{{Date}}'}, {'{{Time}}'}
                </span>
                <textarea
                  rows={6}
                  value={interviewMessageTemplate}
                  onChange={(e) => setInterviewMessageTemplate(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
                  placeholder="Paste the exact message template here"
                />
              </label>
              <div className="spacer" />
              <button className="button primary" type="submit" disabled={settingsLoading}>
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {active === 'logs' ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Logs Viewer</h3>

          <div className="card" style={{ background: '#fafafa' }}>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <label className="small" style={{ display: 'grid', gap: 6 }}>
                Type
                <select
                  value={logType}
                  onChange={(e) => setLogType(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
                >
                  <option value="AUDIT">Audit</option>
                  <option value="REJECTION">Rejection</option>
                  <option value="HOLD">Hold</option>
                  <option value="JOIN">Join</option>
                </select>
              </label>

              <label className="small" style={{ display: 'grid', gap: 6 }}>
                From
                <input
                  type="date"
                  value={logFrom}
                  onChange={(e) => setLogFrom(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
                />
              </label>

              <label className="small" style={{ display: 'grid', gap: 6 }}>
                To
                <input
                  type="date"
                  value={logTo}
                  onChange={(e) => setLogTo(e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd' }}
                />
              </label>

              <input
                placeholder="stageTag (optional)"
                value={stageTag}
                onChange={(e) => setStageTag(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 180, marginTop: 18 }}
              />

              <select
                value={actorRole}
                onChange={(e) => setActorRole(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', marginTop: 18 }}
              >
                <option value="">Actor role (any)</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value="SYSTEM">SYSTEM</option>
              </select>

              {logType === 'AUDIT' ? (
                <>
                  <input
                    placeholder="entityType (AUDIT)"
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 160, marginTop: 18 }}
                  />
                  <input
                    placeholder="entityId (AUDIT)"
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 180, marginTop: 18 }}
                  />
                </>
              ) : (
                <>
                  <input
                    placeholder="candidateId"
                    value={candidateId}
                    onChange={(e) => setCandidateId(e.target.value)}
                    style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 180, marginTop: 18 }}
                  />
                  <input
                    placeholder="requirementId"
                    value={requirementId}
                    onChange={(e) => setRequirementId(e.target.value)}
                    style={{ padding: 8, borderRadius: 8, border: '1px solid #d0d5dd', minWidth: 180, marginTop: 18 }}
                  />
                </>
              )}

              <button className="button primary" type="button" onClick={loadLogs} disabled={logsLoading} style={{ marginTop: 18 }}>
                Refresh
              </button>
            </div>
          </div>

          <div style={{ height: 12 }} />
          <div className="small">{logsLoading ? 'Loading…' : `${logs.length} rows (latest first)`}</div>

          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table width="100%" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  <th align="left">At</th>
                  <th align="left">stageTag</th>
                  <th align="left">actorRole</th>
                  <th align="left">actorUserId</th>
                  <th align="left">remark</th>
                  <th align="left">ref</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={String(l.logId || i)} style={{ borderTop: '1px solid #eee' }}>
                    <td className="small">{l.at ? String(l.at) : '-'}</td>
                    <td className="small">{l.stageTag || '-'}</td>
                    <td className="small">{l.actorRole || '-'}</td>
                    <td className="small">{l.actorUserId || '-'}</td>
                    <td className="small">{l.remark || '-'}</td>
                    <td className="small">
                      {logType === 'AUDIT'
                        ? `${l.entityType || ''}:${l.entityId || ''}`
                        : `${l.candidateId || ''}:${l.requirementId || ''}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
