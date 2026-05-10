import api from './api';

const bearer = (accessToken) => ({ Authorization: `Bearer ${accessToken}` });

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  changePassword: (accessToken, currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }, { headers: bearer(accessToken) }),
  mfaSetup: (accessToken) =>
    api.post('/auth/mfa/setup', {}, { headers: bearer(accessToken) }),
  mfaVerifySetup: (accessToken, token) =>
    api.post('/auth/mfa/verify-setup', { token }, { headers: bearer(accessToken) }),
  mfaDisable: (accessToken, password) =>
    api.post('/auth/mfa/disable', { password }, { headers: bearer(accessToken) }),
  mfaValidate: (tempToken, token) => api.post('/auth/mfa/validate', { tempToken, token }),
};
