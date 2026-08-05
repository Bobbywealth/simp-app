import { create } from 'zustand';
import type { UserResponse } from '../types';
import { loadTokens, getAccessToken } from '../api/client';
import { me, logout as apiLogout } from '../api/auth';

interface AuthState {
  user: UserResponse | null;
  loading: boolean;
  ready: boolean;
  initialized: boolean;
  setUser: (u: UserResponse | null) => void;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  ready: false,
  initialized: false,

  setUser: (u) => set({ user: u, ready: true }),

  initialize: async () => {
    if (get().initialized) return;
    loadTokens();
    const token = getAccessToken();
    if (!token) {
      set({ ready: true, initialized: true });
      return;
    }
    set({ loading: true });
    try {
      const user = await me();
      set({ user, ready: true, initialized: true });
    } catch {
      set({ user: null, ready: true, initialized: true });
    } finally {
      set({ loading: false });
    }
  },

  refresh: async () => {
    try {
      const user = await me();
      set({ user });
    } catch {
      set({ user: null });
    }
  },

  logout: async () => {
    await apiLogout();
    set({ user: null, ready: true });
  },
}));
