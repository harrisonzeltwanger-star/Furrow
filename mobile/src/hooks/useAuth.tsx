import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import api from '../config/api';
import type { User, LoginRequest, RegisterRequest, AuthResponse } from '../types/auth';
import {
  getToken,
  setToken,
  setRefreshToken,
  getStoredUser,
  setStoredUser,
  clearAll,
} from '../utils/storage';
import { EventEmitter } from '../utils/eventEmitter';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from storage on mount
  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        const token = await getToken();
        const storedUser = await getStoredUser<User>();

        if (storedUser && mounted) {
          setUser(storedUser);
        }

        if (token && mounted) {
          try {
            const { data } = await api.get('/auth/me');
            if (mounted) {
              setUser(data.user);
              await setStoredUser(data.user);
            }
          } catch {
            if (mounted) {
              await clearAll();
              setUser(null);
            }
          }
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    hydrate();
    return () => { mounted = false; };
  }, []);

  // Listen for forced logout from API interceptor
  useEffect(() => {
    const unsub = EventEmitter.on('auth:logout', () => {
      setUser(null);
    });
    return unsub;
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    const { token, refreshToken, user: userData } = response.data;
    await setToken(token);
    await setRefreshToken(refreshToken);
    await setStoredUser(userData);
    setUser(userData);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    const { token, refreshToken, user: userData } = response.data;
    await setToken(token);
    await setRefreshToken(refreshToken);
    await setStoredUser(userData);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    await clearAll();
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
