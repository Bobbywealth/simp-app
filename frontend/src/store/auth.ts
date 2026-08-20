import { create } from 'zustand';
import type { UserResponse } from '../types';
import { getAccessToken, loadTokens, refreshAccessToken, setTokens } from '../api/client';
import { logout as apiLogout, me } from '../api/auth';

interface AuthState {
  user: UserResponse | null;
  loading: boolean;
  ready: boolean;
  initialized: boolean;
  setUser: (user: UserResponse | null) => void;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  ready: false,
  initialized: false,

  setUser: (user) => set({ user, ready: true }),

  initialize: async () => {
    if (get().initialized) return;
    set({ initialized: true, loading: true });
    try {
      await loadTokens();
      if (!getAccessToken() && !(await refreshAccessToken())) {
        set({ user: null, ready: true });
        return;
      }
      const user = await me();
      set({ user, ready: true });
    } catch {
      await setTokens(null, null);
      set({ user: null, ready: true });
    } finally {
      set({ loading: false });
    }
  },

  refresh: async () => {
    try {
      set({ user: await me() });
    } catch {
      set({ user: null });
    }
  },

  logout: async () => {
    await apiLogout().catch(() => setTokens(null, null));
    set({ user: null, ready: true });
  },
}));
