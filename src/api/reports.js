import { apiGet, apiRequest } from './restClient';

export function reportsSummary(token, { from, to } = {}) {
  return apiGet('/api/v1/reports/summary', { token, query: { from, to } });
}

export function reportsFunnel(token, { from, to, department } = {}) {
  return apiGet('/api/v1/reports/funnel', { token, query: { from, to, department } });
}

export function reportsExportXlsx(token, { from, to, type = 'summary', department } = {}) {
  return apiRequest('/api/v1/reports/export.xlsx', {
    token,
    query: { from, to, type, department },
    responseType: 'blob',
  });
}

