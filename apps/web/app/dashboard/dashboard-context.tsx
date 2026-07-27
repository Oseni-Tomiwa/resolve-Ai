'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, type OrganizationSummary, type WorkspaceSummary } from '../auth-provider';
import { apiRequest } from '../api-client';

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

const DashboardContext = createContext<DashboardContextValue | null>(null);

async function request<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

function updateSelection(router: ReturnType<typeof useRouter>, pathname: string, organizationId: string, workspaceId: string | null): void {
  const params = new URLSearchParams();
  params.set('organization', organizationId);
  if (workspaceId) params.set('workspace', workspaceId);
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}

function clearWorkspaceState(
  setOrganizations: (value: OrganizationSummary[]) => void,
  setWorkspaces: (value: WorkspaceSummary[]) => void,
  setCurrentOrganization: (value: OrganizationSummary | null) => void,
  setCurrentWorkspace: (value: WorkspaceSummary | null) => void,
  setOrganizationRole: (value: string | null) => void,
  setWorkspaceRole: (value: string | null) => void,
): void {
  setOrganizations([]);
  setWorkspaces([]);
  setCurrentOrganization(null);
  setCurrentWorkspace(null);
  setOrganizationRole(null);
  setWorkspaceRole(null);
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
    setLoading(true);
    setError(null);
    if (!user) {
      clearWorkspaceState(setOrganizations, setWorkspaces, setCurrentOrganization, setCurrentWorkspace, setOrganizationRole, setWorkspaceRole);
      setLoading(false);
      return;
    }
    if (onboarding?.required) {
      clearWorkspaceState(setOrganizations, setWorkspaces, setCurrentOrganization, setCurrentWorkspace, setOrganizationRole, setWorkspaceRole);
      setLoading(false);
      if (pathname.startsWith('/dashboard')) router.replace('/onboarding');
      return;
    }
    try {
      const listed = await request<OrganizationWithMembership[]>('/organizations');
      if (listed.length === 0) {
        clearWorkspaceState(setOrganizations, setWorkspaces, setCurrentOrganization, setCurrentWorkspace, setOrganizationRole, setWorkspaceRole);
        setError('You do not belong to an organization yet. Complete onboarding to continue.');
        setLoading(false);
        if (pathname.startsWith('/dashboard')) router.replace('/onboarding');
        return;
      }
      const url = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
      const requestedId = url.get('organization') ?? (typeof window === 'undefined' ? null : window.localStorage.getItem('resolveai.organizationId'));
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
      if (selectedWorkspaces.length === 0) {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setWorkspaceRole(null);
        setError('This organization has no accessible workspace yet. Complete onboarding or contact an administrator.');
        if (typeof window !== 'undefined') window.localStorage.removeItem('resolveai.workspaceId');
        updateSelection(router, pathname, selected.id, null);
        return;
      }
      const requestedWorkspaceId = url.get('workspace') ?? (typeof window === 'undefined' ? null : window.localStorage.getItem('resolveai.workspaceId'));
      const selectedWorkspace = selectedWorkspaces.find((item) => item.id === requestedWorkspaceId) ?? selectedWorkspaces[0] ?? null;
      setWorkspaces(selectedWorkspaces);
      setCurrentWorkspace(selectedWorkspace);
      setWorkspaceRole(selectedWorkspace?.members?.[0]?.role ?? null);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('resolveai.organizationId', selected.id);
        if (selectedWorkspace) window.localStorage.setItem('resolveai.workspaceId', selectedWorkspace.id);
        else window.localStorage.removeItem('resolveai.workspaceId');
      }
      updateSelection(router, pathname, selected.id, selectedWorkspace?.id ?? null);
    } catch (cause) {
      clearWorkspaceState(setOrganizations, setWorkspaces, setCurrentOrganization, setCurrentWorkspace, setOrganizationRole, setWorkspaceRole);
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
      setOrganizationRole(organization?.members?.[0]?.role ?? null);
      setWorkspaceRole(nextWorkspace?.members?.[0]?.role ?? null);
      if (!nextWorkspace) {
        setError('This organization has no accessible workspace yet. Complete onboarding or contact an administrator.');
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('resolveai.organizationId', organizationId);
        if (nextWorkspace) window.localStorage.setItem('resolveai.workspaceId', nextWorkspace.id);
        else window.localStorage.removeItem('resolveai.workspaceId');
      }
      updateSelection(router, pathname, organizationId, nextWorkspace?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to switch organization.');
    } finally { setLoading(false); }
  }, [organizations, pathname, router]);

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    if (!currentOrganization || !workspaces.some((item) => item.id === workspaceId)) throw new Error('Workspace access was denied.');
    const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
    setCurrentWorkspace(workspace);
    setWorkspaceRole(workspace?.members?.[0]?.role ?? null);
    if (typeof window !== 'undefined') window.localStorage.setItem('resolveai.workspaceId', workspaceId);
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
