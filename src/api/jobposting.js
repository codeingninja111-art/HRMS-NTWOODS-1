import { apiPost } from './client';

export function jobpostInit(token, { requirementId }) {
  return apiPost('JOBPOST_INIT', { requirementId }, token);
}

export function jobpostSetPortals(token, { requirementId, portals }) {
  return apiPost('JOBPOST_SET_PORTALS', { requirementId, portals }, token);
}

export function jobpostUploadScreenshot(token, { requirementId, portalKey, filename, mimeType, base64 }) {
  return apiPost(
    'JOBPOST_UPLOAD_SCREENSHOT',
    { requirementId, portalKey, filename, mimeType, base64 },
    token
  );
}

export function jobpostMarkPortal(token, { requirementId, portalKey }) {
  return apiPost('JOBPOST_MARK_PORTAL', { requirementId, portalKey }, token);
}

export function jobpostComplete(token, { requirementId }) {
  return apiPost('JOBPOST_COMPLETE', { requirementId }, token);
}
