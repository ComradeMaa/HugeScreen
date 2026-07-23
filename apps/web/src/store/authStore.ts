import { create } from 'zustand';
import { apiFetch } from '../utils/api';

interface User {
  id: string;
  username: string;
  is_guest: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  upgradeGuest: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('hugescreen-token'),
  isLoading: true,
  error: null,

  login: async (username, password) => {
    set({ error: null });
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');
    localStorage.setItem('hugescreen-token', data.token);
    set({ user: data.user, token: data.token, isLoading: false });
  },

  register: async (username, password) => {
    set({ error: null });
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');
    localStorage.setItem('hugescreen-token', data.token);
    set({ user: data.user, token: data.token, isLoading: false });
  },

  loginAsGuest: async () => {
    set({ error: null });
    const res = await apiFetch('/api/auth/guest', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '游客登录失败');
    localStorage.setItem('hugescreen-token', data.token);
    set({ user: data.user, token: data.token, isLoading: false });
  },

  upgradeGuest: async (username, password) => {
    const res = await apiFetch('/api/auth/upgrade', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || '升级失败' };
    localStorage.setItem('hugescreen-token', data.token);
    set({ user: data.user, token: data.token });
    return { success: true };
  },

  logout: () => {
    localStorage.removeItem('hugescreen-token');
    set({ user: null, token: null, isLoading: false });
    window.location.href = '/login';
  },

  checkAuth: async () => {
    const token = localStorage.getItem('hugescreen-token');
    if (!token) {
      set({ user: null, token: null, isLoading: false });
      return;
    }
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, token, isLoading: false });
      } else {
        localStorage.removeItem('hugescreen-token');
        set({ user: null, token: null, isLoading: false });
      }
    } catch {
      set({ user: null, token: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
