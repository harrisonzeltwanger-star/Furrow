import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import api from '@/services/api';
import type { User, LoginRequest, RegisterRequest, AuthResponse } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('hay_portal_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hay_portal_token');
    if (token && !user) {
      api.get('/auth/me')
        .then(({ data }) => {
          setUser(data.user);
          localStorage.setItem('hay_portal_user', JSON.stringify(data.user));
        })
        .catch(() => {
          localStorage.removeItem('hay_portal_token');
          localStorage.removeItem('hay_portal_refresh_token');
          localStorage.removeItem('hay_portal_user');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    const { token, refreshToken, user: userData } = response.data;
    localStorage.setItem('hay_portal_token', token);
    localStorage.setItem('hay_portal_refresh_token', refreshToken);
    localStorage.setItem('hay_portal_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    const { token, refreshToken, user: userData } = response.data;
    localStorage.setItem('hay_portal_token', token);
    localStorage.setItem('hay_portal_refresh_token', refreshToken);
    localStorage.setItem('hay_portal_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hay_portal_token');
    localStorage.removeItem('hay_portal_refresh_token');
    localStorage.removeItem('hay_portal_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
