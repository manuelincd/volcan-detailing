import api from './api';

const headers = (token) => ({ Authorization: `Bearer ${token}` });

export const appointmentService = {
  list: (token) => api.get('/appointments', { headers: headers(token) }),
  create: (token, data) => api.post('/appointments', data, { headers: headers(token) }),
  get: (token, id) => api.get(`/appointments/${id}`, { headers: headers(token) }),
  update: (token, id, data) => api.patch(`/appointments/${id}`, data, { headers: headers(token) }),
  remove: (token, id) => api.delete(`/appointments/${id}`, { headers: headers(token) }),
};
