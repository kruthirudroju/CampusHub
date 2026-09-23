import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ch_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 means the session is gone -- clear it and bounce to the picker.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('ch_token');
      localStorage.removeItem('ch_user');
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
