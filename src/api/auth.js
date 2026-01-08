import { apiGet, apiPost } from './restClient';

export function login(email, password) {
  return apiPost('/api/v1/auth/login', { email, password });
}

export function me(token) {
  return apiGet('/api/v1/auth/me', { token });
}

