'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, type OrganizationSummary, type WorkspaceSummary } from '../auth-provider';

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };
type OrganizationWithMembership = OrganizationSummary;
type DashboardContextValue = {
  organizations: OrganizationSummary[];
  workspaces: WorkspaceSummary[];
  currentOrganization: OrganizationSummary | null;
  currentWorkspace: WorkspaceSummary | null;
  organizationRole: string | null;
  workspaceRole: string | null;
  loading: boolean;
  error: string | null;
  selectOrganization: (organizationId: string) => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  reload: () => Promise<void>;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const DashboardContext = createContext<DashboardContextValue | null>(null);

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' } });
  const body = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !body.success || body.data === undefined) throw new Error(body.message ?? 'Unable to load workspace data.');
  return body.data;
}

function updateSelection(router: ReturnType<typeof useRouter>, pathname: string, organizationId: string, workspaceId: string | null): void {
  const params = new URLSearchParams();
  params.set('organization', organizationId);
  if (workspaceId) params.set('workspace', workspaceId);
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user, onboarding, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationSummary | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceSummary | null>(null);
  const [organizationRole, setOrganizationRole] = useState<string | null>(null);
  const [workspaceRole, setWorkspaceRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    if (!user || onboarding?.required) return;
    setLoading(true);
    setError(null);
    try {
      const listed = await request<OrganizationWithMembership[]>('/organizations');
      const url = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
      const requestedId = url.get('organization');
      const selected = listed.find((item) => item.id === requestedId) ?? listed[0] ?? null;
      setOrganizations(listed);
      setCurrentOrganization(selected);
      setOrganizationRole(selected?.members?.[0]?.role ?? null);
      if (!selected) {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        return;
      }
      const selectedWorkspaces = await request<WorkspaceSummary[]>(`/organizations/${selected.id}/workspaces`);
      const requestedWorkspaceId = url.get('workspace');
      const selectedWorkspace = selectedWorkspaces.find((item) => item.id === requestedWorkspaceId) ?? selectedWorkspaces[0] ?? null;
      setWorkspaces(selectedWorkspaces);
      setCurrentWorkspace(selectedWorkspace);
      setWorkspaceRole(selectedWorkspace?.members?.[0]?.role ?? null);
      updateSelection(router, pathname, selected.id, selectedWorkspace?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load workspace data.');
    } finally {
      setLoading(false);
    }
  }, [onboarding?.required, pathname, router, user]);

  useEffect(() => { if (!authLoading) void loadOrganizations(); }, [authLoading, loadOrganizations]);

  const selectOrganization = useCallback(async (organizationId: string) => {
    if (!organizations.some((item) => item.id === organizationId)) throw new Error('Organization access was denied.');
    setLoading(true);
    setError(null);
    try {
      const organization = organizations.find((item) => item.id === organizationId) ?? null;
      const nextWorkspaces = await request<WorkspaceSummary[]>(`/organizations/${organizationId}/workspaces`);
      const nextWorkspace = nextWorkspaces[0] ?? null;
      setCurrentOrganization(organization);
      setCurrentWorkspace(nextWorkspace);
      setWorkspaces(nextWorkspaces);
      setOrganizationRole(null);
      setWorkspaceRole(nextWorkspace?.members?.[0]?.role ?? null);
      updateSelection(router, pathname, organizationId, nextWorkspace?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to switch organization.');
    } finally { setLoading(false); }
  }, [organizations, pathname, router]);

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    if (!currentOrganization || !workspaces.some((item) => item.id === workspaceId)) throw new Error('Workspace access was denied.');
    setCurrentWorkspace(workspaces.find((item) => item.id === workspaceId) ?? null);
    updateSelection(router, pathname, currentOrganization.id, workspaceId);
  }, [currentOrganization, pathname, router, workspaces]);

  const value = useMemo(() => ({ organizations, workspaces, currentOrganization, currentWorkspace, organizationRole, workspaceRole, loading, error, selectOrganization, selectWorkspace, reload: loadOrganizations }), [currentOrganization, currentWorkspace, error, loadOrganizations, loading, organizationRole, organizations, selectOrganization, selectWorkspace, workspaces, workspaceRole]);
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const value = useContext(DashboardContext);
  if (!value) throw new Error('useDashboard must be used within DashboardProvider');
  return value;
}
