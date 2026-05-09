import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

let _refreshToken = null;
export const setRefresher = (fn) => { _refreshToken = fn; };

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const code = err.response?.data?.code;

    // Only attempt silent refresh on TOKEN_EXPIRED, not on INVALID_TOKEN or UNAUTHORIZED
    if (code === 'TOKEN_EXPIRED' && !original._retry && _refreshToken) {
      original._retry = true;
      try {
        const newToken = await _refreshToken();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        // Refresh itself failed — fall through and reject so the caller can redirect to login
      }
    }

    return Promise.reject(err);
  }
);

export default api;
