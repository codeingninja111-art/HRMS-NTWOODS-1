import { apiPost } from './client';

export function usersList(token, { role = null, status = null, q = null, page = 1, pageSize = 200 } = {}) {
  return apiPost('USERS_LIST', { role, status, q, page, pageSize }, token);
}

export function usersUpsert(token, { email, fullName, role, active } = {}) {
  return apiPost('USERS_UPSERT', { email, fullName, role, active }, token);
}

export function rolesList(token, { includeInactive = true } = {}) {
  return apiPost('ROLES_LIST', { includeInactive }, token);
}

export function rolesUpsert(token, { roleCode, roleName, status } = {}) {
  return apiPost('ROLES_UPSERT', { roleCode, roleName, status }, token);
}

export function permissionsList(token) {
  return apiPost('PERMISSIONS_LIST', {}, token);
}

export function permissionsUpsert(token, items) {
  return apiPost('PERMISSIONS_UPSERT', { items }, token);
}

export function myPermissionsGet(token) {
  return apiPost('MY_PERMISSIONS_GET', {}, token);
}

export function templateList(token, { status = null, q = null, page = 1, pageSize = 200 } = {}) {
  return apiPost('TEMPLATE_LIST', { status, q, page, pageSize }, token);
}

export function templateUpsert(
  token,
  {
    templateId = null,
    jobRole,
    jobTitle,
    jd,
    responsibilities,
    skills,
    shift,
    payScale,
    perks,
    notes,
    active,
  } = {}
) {
  return apiPost(
    'TEMPLATE_UPSERT',
    { templateId, jobRole, jobTitle, jd, responsibilities, skills, shift, payScale, perks, notes, active },
    token
  );
}

export function settingsGet(token) {
  return apiPost('SETTINGS_GET', {}, token);
}

export function settingsUpsert(token, items) {
  return apiPost('SETTINGS_UPSERT', { items }, token);
}

export function logsQuery(
  token,
  {
    logType = 'AUDIT',
    from = null,
    to = null,
    stageTag = null,
    actorRole = null,
    entityType = null,
    entityId = null,
    candidateId = null,
    requirementId = null,
    page = 1,
    pageSize = 200,
  } = {}
) {
  return apiPost(
    'LOGS_QUERY',
    { logType, from, to, stageTag, actorRole, entityType, entityId, candidateId, requirementId, page, pageSize },
    token
  );
}

// SLA + Metrics
export function slaConfigGet(token) {
  return apiPost('SLA_CONFIG_GET', {}, token);
}

export function slaConfigUpsert(token, items) {
  return apiPost('SLA_CONFIG_UPSERT', { items: items || [] }, token);
}

export function stepMetricsQuery(token, { stepName, requirementId, candidateId, dateFrom, dateTo } = {}) {
  return apiPost('STEP_METRICS_QUERY', { stepName, requirementId, candidateId, dateFrom, dateTo }, token);
}

// TestMaster admin
export function testMasterUpsert(token, items) {
  return apiPost('TEST_MASTER_UPSERT', { items: items || [] }, token);
}
