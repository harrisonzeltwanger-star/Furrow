import axios from 'axios';
import { API_BASE_URL } from './env';
import { getToken, getRefreshToken, setToken, setRefreshToken, clearAll } from '../utils/storage';
import { EventEmitter } from '../utils/eventEmitter';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach JWT token
api.interceptors.request.use(async (config) => {
  const token = await getToken();
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

      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          await setToken(data.token);
          await setRefreshToken(data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return api(originalRequest);
        } catch {
          await clearAll();
          EventEmitter.emit('auth:logout');
        }
      } else {
        await clearAll();
        EventEmitter.emit('auth:logout');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
