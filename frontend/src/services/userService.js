import api from './api';

const h = (token) => ({ Authorization: `Bearer ${token}` });

export const userService = {
  list:       (token)           => api.get('/users',      { headers: h(token) }),
  create:     (token, data)     => api.post('/users', data, { headers: h(token) }),
  update:     (token, id, data) => api.put(`/users/${id}`, data, { headers: h(token) }),
  deactivate: (token, id)       => api.delete(`/users/${id}`, { headers: h(token) }),
};
