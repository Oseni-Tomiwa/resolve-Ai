'use client';

import Link from 'next/link';
import { EmptyState } from '../empty-state';
import { useDashboard } from '../dashboard-context';

export default function Settings() {
  const { currentOrganization, currentWorkspace } = useDashboard();
  return <section className="settings-page"><div className="settings-intro"><p className="eyebrow">Workspace settings</p><h2>Keep your foundation clear.</h2><p>Manage the organization and workspace details that will power your ResolveAI setup.</p></div><div className="settings-summary"><div><span>Organization</span><strong>{currentOrganization?.name ?? 'Loading…'}</strong></div><div><span>Workspace</span><strong>{currentWorkspace?.name ?? 'Loading…'}</strong></div></div><nav className="settings-tabs" aria-label="Settings sections"><Link href="/dashboard/settings/general">General</Link><Link href="/dashboard/settings/members">Members</Link><Link href="/dashboard/settings/security">Security</Link></nav><EmptyState eyebrow="Settings" title="Your workspace controls are coming together." description="General details, member access, and security controls will appear here as the workspace grows." /></section>;
}
