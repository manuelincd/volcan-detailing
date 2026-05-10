import api from './api';

export const availabilityService = {
  getSlots: (date) => api.get(`/availability?date=${date}`),
};
