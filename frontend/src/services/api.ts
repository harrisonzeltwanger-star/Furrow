import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hay_portal_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401s and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('hay_portal_refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
          localStorage.setItem('hay_portal_token', data.token);
          localStorage.setItem('hay_portal_refresh_token', data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('hay_portal_token');
          localStorage.removeItem('hay_portal_refresh_token');
          localStorage.removeItem('hay_portal_user');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('hay_portal_token');
        localStorage.removeItem('hay_portal_user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
