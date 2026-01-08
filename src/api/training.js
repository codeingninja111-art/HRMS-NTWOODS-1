import { apiPost } from './client';

export function trainingMasterList(token, { department } = {}) {
  return apiPost('TRAINING_MASTER_LIST', { department: department || '' }, token);
}

export function trainingMasterUpsert(token, payload) {
  return apiPost('TRAINING_MASTER_UPSERT', payload || {}, token);
}

export function assignTraining(token, payload) {
  return apiPost('TRAINING_ASSIGN', payload || {}, token);
}

export function trainingList(token, { candidateId } = {}) {
  return apiPost('TRAINING_LIST', { candidate_id: candidateId }, token);
}

export function updateTrainingStatus(token, payload) {
  return apiPost('TRAINING_STATUS_UPDATE', payload || {}, token);
}

export function trainingSummary(token, { candidateId } = {}) {
  return apiPost('TRAINING_SUMMARY', { candidate_id: candidateId }, token);
}

export function trainingDashboard(token, { scope } = {}) {
  return apiPost('TRAINING_DASHBOARD', { scope: scope || 'PROBATION' }, token);
}

export function trainingMarkComplete(token, { requirementId, candidateId } = {}) {
  return apiPost('TRAINING_MARK_COMPLETE', { requirementId, candidateId }, token);
}

export function trainingClose(token, { requirementId, candidateId } = {}) {
  return apiPost('TRAINING_CLOSE', { requirementId, candidateId }, token);
}
