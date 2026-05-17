import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';
import type { AuthUser, Role } from '@/types';

interface JwtPayload {
  sub: string;       // username (always present)
  id?: string;       // userId if encoded by the backend
  email?: string;    // email if encoded by the backend
  role?: string;     // role if encoded by the backend
  exp: number;
  iat: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  /**
   * Call after a successful login/register.
   * Decodes the JWT to extract id, email, and role.
   * Pass `user` explicitly when the API response includes richer user data.
   */
  setAuth: (token: string, user?: Partial<AuthUser>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,

      setAuth: (token, user) => {
        const decoded = jwtDecode<JwtPayload>(token);
        set({
          token,
          user: {
            id:       user?.id       ?? decoded.id       ?? decoded.sub,
            username: user?.username  ?? decoded.sub,
            email:    user?.email    ?? decoded.email    ?? decoded.sub,
            role:    (user?.role     ?? decoded.role     ?? 'MEMBER') as Role,
          },
        });
      },

      clearAuth: () => set({ user: null, token: null }),
    }),
    { name: 'auth' }
  )
);
