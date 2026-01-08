import { apiPost } from './client';

export function loginExchange(idToken) {
  return apiPost('LOGIN_EXCHANGE', { idToken }, null);
}

export function employeeLogin(employeeId) {
  return apiPost('EMPLOYEE_LOGIN', { employeeId }, null);
}

export function sessionValidate(token) {
  return apiPost('SESSION_VALIDATE', {}, token);
}

export function getMe(token) {
  return apiPost('GET_ME', {}, token);
}
