import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  cedula: string;
  nombre: string;
  apellido: string;
  departamento: string;
  departamento_id: number;
  rol: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);