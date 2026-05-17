import api from './axios';
import type { ApiResponse, AuthUser } from '@/types';

interface AuthResponse {
  token: string;
  type: string;
  user: AuthUser & { createdAt: string };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export async function login(payload: LoginPayload) {
  const res = await api.post<ApiResponse<AuthResponse>>('/api/auth/login', payload);
  return res.data.data;
}

export async function register(payload: RegisterPayload) {
  const res = await api.post<ApiResponse<AuthResponse>>('/api/auth/register', payload);
  return res.data.data;
}
