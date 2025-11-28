import { authAPI } from './api';

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  warehouseId?: number;
}

export interface AuthToken {
  token: string;
  user: User;
}

export const login = async (username: string, password: string): Promise<AuthToken> => {
  const response = await authAPI.login(username, password);
  const { token, user } = response.data;
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }
  
  return { token, user };
};

export const logout = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!getStoredToken();
};
