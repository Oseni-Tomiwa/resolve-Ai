'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AuthUser = { id: string; firstName: string; lastName: string; email: string; emailVerifiedAt: string | null; createdAt: string; updatedAt: string };
export type WorkspaceSummary = { id: string; organizationId: string; name: string; slug: string; createdAt?: string; updatedAt?: string; members?: Array<{ role: string }> };
export type OrganizationSummary = { id: string; name: string; slug: string; createdAt?: string; updatedAt?: string; workspaces?: WorkspaceSummary[]; members?: Array<{ role: string }> };
export type OnboardingState = { required: boolean; organizations: OrganizationSummary[]; currentOrganization: OrganizationSummary | null; currentWorkspace: WorkspaceSummary | null };
type Credentials = { email: string; password: string };
type Registration = Credentials & { firstName: string; lastName: string };
export type OnboardingInput = { organizationName: string; organizationSlug: string; workspaceName: string; workspaceSlug: string; industry: string; teamSize: string };
type ApiResponse = { success: boolean; message?: string; data?: { user?: AuthUser; onboarding?: OnboardingState; organization?: OnboardingState['currentOrganization']; workspace?: OnboardingState['currentWorkspace'] } };
type AuthContextValue = { user: AuthUser | null; onboarding: OnboardingState | null; loading: boolean; authenticated: boolean; login: (credentials: Credentials) => Promise<void>; register: (details: Registration) => Promise<void>; createOnboarding: (input: OnboardingInput) => Promise<void>; logout: () => Promise<void>; refreshSession: () => Promise<AuthUser | null> };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const AuthContext = createContext<AuthContextValue | null>(null);

async function request(path: string, init?: RequestInit): Promise<ApiResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  let body: ApiResponse;
  try { body = await response.json() as ApiResponse; } catch { throw new Error('The server returned an unreadable response.'); }
  if (!response.ok || !body.success) throw new Error(body.message ?? 'The request could not be completed.');
  return body;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async (): Promise<AuthUser | null> => {
    try { const result = await request('/auth/me'); const currentUser = result.data?.user ?? null; setUser(currentUser); setOnboarding(result.data?.onboarding ?? null); return currentUser; } catch { try { await request('/auth/refresh', { method: 'POST', body: JSON.stringify({}) }); const result = await request('/auth/me'); const currentUser = result.data?.user ?? null; setUser(currentUser); setOnboarding(result.data?.onboarding ?? null); return currentUser; } catch { setUser(null); setOnboarding(null); return null; } }
  }, []);

  useEffect(() => { void refreshSession().finally(() => setLoading(false)); }, [refreshSession]);

  const value = useMemo<AuthContextValue>(() => ({ user, onboarding, loading, authenticated: user !== null, refreshSession, login: async (credentials) => { await request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }); await refreshSession(); }, register: async (details) => { await request('/auth/register', { method: 'POST', body: JSON.stringify(details) }); await refreshSession(); }, createOnboarding: async (input) => { await request('/onboarding', { method: 'POST', body: JSON.stringify(input) }); await refreshSession(); }, logout: async () => { try { await request('/auth/logout', { method: 'POST', body: JSON.stringify({}) }); } finally { setUser(null); setOnboarding(null); } } }), [loading, onboarding, refreshSession, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider'); return value; }
