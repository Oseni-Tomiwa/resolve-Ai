'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../auth-provider';

export default function Dashboard() {
  const router = useRouter();
  const { user, onboarding, loading, logout } = useAuth();
  if (loading) return <main className="dashboard-shell"><div className="dashboard-loading">Loading your workspace…</div></main>;
  if (!user) { if (typeof window !== 'undefined') router.replace('/login'); return <main className="dashboard-shell"><div className="dashboard-loading">Redirecting to sign in…</div></main>; }
  if (onboarding?.required) { if (typeof window !== 'undefined') router.replace('/onboarding'); return <main className="dashboard-shell"><div className="dashboard-loading">Preparing your workspace…</div></main>; }
  async function signOut(): Promise<void> { await logout(); router.replace('/login'); }
  return <main className="dashboard-shell"><header className="dashboard-header"><div className="brand"><span className="brand-mark">R</span><span>resolve<span className="brand-accent">ai</span></span></div><nav aria-label="Dashboard navigation"><a className="dashboard-nav-active" href="/dashboard">Overview</a><a href="/dashboard/organizations">Organizations</a><a href="/dashboard/settings">Settings</a></nav><div className="dashboard-account"><div className="dashboard-avatar">{user.firstName[0]}{user.lastName[0]}</div><div><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></div><button type="button" onClick={signOut}>Log out</button></div></header><section className="dashboard-content"><div className="dashboard-context"><span>Organization</span><strong>{onboarding?.currentOrganization?.name}</strong><span>Workspace</span><strong>{onboarding?.currentWorkspace?.name}</strong></div><p className="eyebrow">Overview</p><h1>Good morning, {user.firstName}.</h1><p className="dashboard-lede">Your ResolveAI workspace is ready.</p><div className="dashboard-empty"><span className="dashboard-empty-icon">✦</span><h2>Your workspace is ready</h2><p>Start shaping the support experience for your team.</p><div className="dashboard-next-steps"><span>Add knowledge <small>Coming next</small></span><span>Configure AI agent <small>Coming next</small></span><span>Invite teammates <small>Coming next</small></span><span>Install chat widget <small>Coming next</small></span></div></div></section></main>;
}
