'use client';

import Link from 'next/link';
import { useDashboard } from '../dashboard-context';

export default function Settings() {
  const { currentOrganization, currentWorkspace } = useDashboard();
  return <section className="settings-page"><div className="settings-intro"><p className="eyebrow">Workspace settings</p><h2>Keep your foundation clear.</h2><p>Manage organization details, member access, and account security.</p></div><div className="settings-summary"><div><span>Organization</span><strong>{currentOrganization?.name ?? 'Loading…'}</strong></div><div><span>Workspace</span><strong>{currentWorkspace?.name ?? 'Loading…'}</strong></div></div><nav className="settings-tabs" aria-label="Settings sections"><Link href="/dashboard/settings/general">General</Link><Link href="/dashboard/settings/members">Members</Link><Link href="/dashboard/settings/security">Security</Link><Link href="/dashboard/settings/audit-logs">Audit log</Link><Link href="/dashboard/settings/api-keys">API keys</Link><Link href="/dashboard/settings/webhooks">Webhooks</Link></nav><div className="settings-summary"><div><span>Workspace configuration</span><strong><Link href="/dashboard/settings/general">Edit general details →</Link></strong></div><div><span>Access</span><strong><Link href="/dashboard/settings/members">Manage members →</Link></strong></div><div><span>Account</span><strong><Link href="/dashboard/settings/security">Review security →</Link></strong></div></div></section>;
}
