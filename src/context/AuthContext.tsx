import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, setAuthToken } from '../lib/api';
import type { UserPublic } from '../shared/types';

interface AuthContextValue {
  user: UserPublic | null;
  loading: boolean;
  unreadNotifications: number;
  pendingInvitations: number;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<UserPublic>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => Promise<{ user: UserPublic; verificationTokenPreview?: string }>;
  logout: () => Promise<void>;
  setDirectSession: (user: UserPublic, token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingInvitations, setPendingInvitations] = useState(0);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch<{
        user: UserPublic | null;
        unreadNotifications?: number;
        pendingInvitations?: number;
      }>('/api/auth/me');
      setUser(res.user);
      setUnreadNotifications(res.unreadNotifications || 0);
      setPendingInvitations(res.pendingInvitations || 0);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: UserPublic }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(res.token);
    setUser(res.user);
    await refreshUser();
    return res.user;
  };

  const register = async (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => {
    const res = await apiFetch<{
      token: string;
      user: UserPublic;
      verificationTokenPreview?: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setAuthToken(res.token);
    setUser(res.user);
    return { user: res.user, verificationTokenPreview: res.verificationTokenPreview };
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
      setUser(null);
      setUnreadNotifications(0);
      setPendingInvitations(0);
    }
  };

  const setDirectSession = (u: UserPublic, token: string) => {
    setAuthToken(token);
    setUser(u);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        unreadNotifications,
        pendingInvitations,
        refreshUser,
        login,
        register,
        logout,
        setDirectSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
