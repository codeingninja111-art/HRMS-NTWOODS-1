import { apiPost } from './client';

export function testTokenValidate({ token } = {}) {
  return apiPost('TEST_TOKEN_VALIDATE', { token }, null);
}

export function testQuestionsGet({ token } = {}) {
  return apiPost('TEST_QUESTIONS_GET', { token }, null);
}

export function testSubmitPublic({ token, fullName, applyingFor, source, answers } = {}) {
  return apiPost('TEST_SUBMIT_PUBLIC', { token, fullName, applyingFor, source, answers }, null);
}

export function testResultGet({ token } = {}) {
  return apiPost('TEST_RESULT_GET', { token }, null);
}
