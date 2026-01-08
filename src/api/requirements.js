import { apiPost } from './client';

export function requirementListByRole(token, { tab = 'OPEN', countOnly } = {}) {
  return apiPost('REQUIREMENT_LIST_BY_ROLE', { tab, countOnly: !!countOnly }, token);
}

export function requirementGet(token, { requirementId }) {
  return apiPost('REQUIREMENT_GET', { requirementId }, token);
}

export function hrRequirementsList(token, { tab = 'OPEN', countOnly } = {}) {
  return apiPost('HR_REQUIREMENTS_LIST', { tab, countOnly: !!countOnly }, token);
}

export function requirementCreate(token, payload) {
  return apiPost('REQUIREMENT_CREATE', payload, token);
}

export function requirementUpdate(token, payload) {
  return apiPost('REQUIREMENT_UPDATE', payload, token);
}

export function requirementSubmit(token, { requirementId }) {
  return apiPost('REQUIREMENT_SUBMIT', { requirementId }, token);
}

export function requirementResubmit(token, { requirementId, remark }) {
  return apiPost('REQUIREMENT_RESUBMIT', { requirementId, remark }, token);
}

export function requirementApprove(token, { requirementId }) {
  return apiPost('REQUIREMENT_APPROVE', { requirementId }, token);
}

export function requirementClarification(token, { requirementId, remark }) {
  return apiPost('REQUIREMENT_CLARIFICATION', { requirementId, remark }, token);
}
