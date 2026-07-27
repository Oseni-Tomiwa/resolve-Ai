'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, registerSessionFailureHandler } from './api-client';

export type AuthUser = { id: string; firstName: string; lastName: string; email: string; emailVerifiedAt: string | null; createdAt: string; updatedAt: string };
export type WorkspaceSummary = { id: string; organizationId: string; name: string; slug: string; createdAt?: string; updatedAt?: string; members?: Array<{ role: string }> };
export type OrganizationSummary = { id: string; name: string; slug: string; createdAt?: string; updatedAt?: string; workspaces?: WorkspaceSummary[]; members?: Array<{ role: string }> };
export type OnboardingState = { required: boolean; organizations: OrganizationSummary[]; currentOrganization: OrganizationSummary | null; currentWorkspace: WorkspaceSummary | null };
type Credentials = { email: string; password: string };
type Registration = Credentials & { firstName: string; lastName: string };
export type OnboardingInput = { organizationName: string; organizationSlug: string; workspaceName: string; workspaceSlug: string; industry: string; teamSize: string };
type ApiResponse = { success: boolean; message?: string; data?: { user?: AuthUser; onboarding?: OnboardingState; organization?: OnboardingState['currentOrganization']; workspace?: OnboardingState['currentWorkspace'] } };
type AuthContextValue = { user: AuthUser | null; onboarding: OnboardingState | null; loading: boolean; authenticated: boolean; sessionExpired: boolean; login: (credentials: Credentials) => Promise<void>; register: (details: Registration) => Promise<void>; createOnboarding: (input: OnboardingInput) => Promise<void>; logout: () => Promise<void>; clearSession: () => void; refreshSession: () => Promise<AuthUser | null> };

const AuthContext = createContext<AuthContextValue | null>(null);
export const clearClientSession = (): void => {
  if (typeof window === 'undefined') return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith('resolveai.')) storage.removeItem(key);
    }
  }
};

async function request(path: string, init?: RequestInit): Promise<ApiResponse> {
  const response = await apiFetch(path, init, { retryOnUnauthorized: false });
  let body: ApiResponse;
  try { body = await response.json() as ApiResponse; } catch { throw new Error('The server returned an unreadable response.'); }
  if (!response.ok || !body.success) throw new Error(body.message ?? 'The request could not be completed.');
  return body;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const applySession = useCallback((result: ApiResponse): AuthUser | null => {
    const currentUser = result.data?.user ?? null;
    setUser(currentUser);
    setOnboarding(result.data?.onboarding ?? null);
    setSessionExpired(false);
    return currentUser;
  }, []);

  const expireSession = useCallback((): null => {
    clearClientSession();
    setUser(null);
    setOnboarding(null);
    setSessionExpired(true);
    return null;
  }, []);

  const refreshSession = useCallback(async (): Promise<AuthUser | null> => {
    try {
      return applySession(await request('/auth/me'));
    } catch {
      try {
        await request('/auth/refresh', { method: 'POST', body: JSON.stringify({}) });
        return applySession(await request('/auth/me'));
      } catch {
        return expireSession();
      }
    }
  }, [applySession, expireSession]);

  useEffect(() => { void refreshSession().finally(() => setLoading(false)); }, [refreshSession]);
  useEffect(() => registerSessionFailureHandler(() => { expireSession(); }), [expireSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user, onboarding, loading, authenticated: user !== null, sessionExpired, refreshSession, clearSession: expireSession,
    login: async (credentials) => { await request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }); await refreshSession(); },
    register: async (details) => { await request('/auth/register', { method: 'POST', body: JSON.stringify(details) }); await refreshSession(); },
    createOnboarding: async (input) => { await request('/onboarding', { method: 'POST', body: JSON.stringify(input) }); await refreshSession(); },
    logout: async () => { try { await request('/auth/logout', { method: 'POST', body: JSON.stringify({}) }); } finally { clearClientSession(); setUser(null); setOnboarding(null); setSessionExpired(false); } },
  }), [expireSession, loading, onboarding, refreshSession, sessionExpired, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider'); return value; }
