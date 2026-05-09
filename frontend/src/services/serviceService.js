import api from './api';

const h = (token) => ({ Authorization: `Bearer ${token}` });

export const serviceService = {
  list:   ()                    => api.get('/services'),
  create: (token, data)         => api.post('/services', data,        { headers: h(token) }),
  update: (token, id, data)     => api.put(`/services/${id}`, data,   { headers: h(token) }),
  remove: (token, id)           => api.delete(`/services/${id}`,      { headers: h(token) }),
};
