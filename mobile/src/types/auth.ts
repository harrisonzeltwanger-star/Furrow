export interface User {
  id: string;
  email: string;
  name: string;
  role: 'FARM_ADMIN' | 'MANAGER' | 'VIEWER';
  organizationId: string;
  organizationName: string;
  organizationAddress?: string | null;
  organizationLatitude?: number | null;
  organizationLongitude?: number | null;
  phone?: string;
  lastLogin?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  organizationName: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}
