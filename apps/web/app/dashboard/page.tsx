'use client';

import Link from 'next/link';
import { useAuth } from '../auth-provider';
import { useDashboard } from './dashboard-context';

const nextSteps = [
  ['Add knowledge', 'Give your future AI agent the context it needs to answer customers clearly.', '/dashboard/knowledge'],
  ['Configure AI agent', 'Shape tone, escalation rules, and the support experience for your team.', '/dashboard/ai-agent'],
  ['Invite teammates', 'Bring your support team into the workspace when collaboration is ready.', '/dashboard/team'],
  ['Install chat widget', 'Connect ResolveAI to your customer-facing support surface.', '/dashboard/inbox'],
] as const;

export default function DashboardOverview() {
  const { user } = useAuth();
  const { currentOrganization, currentWorkspace } = useDashboard();
  return <section className="overview-page"><div className="overview-welcome"><p className="eyebrow"><span className="eyebrow-dot" /> Onboarding complete</p><h2>Good morning, {user?.firstName}.</h2><p>Your workspace is ready. Take the next step when you’re ready.</p></div><div className="overview-context"><div><span>Organization</span><strong>{currentOrganization?.name ?? 'Loading…'}</strong></div><div><span>Workspace</span><strong>{currentWorkspace?.name ?? 'Loading…'}</strong></div><div><span>Environment</span><strong>Ready to configure</strong></div></div><div className="section-heading"><div><p className="eyebrow">Next steps</p><h3>Build your support foundation</h3></div><span className="section-hint">Features will unlock as you configure your workspace.</span></div><div className="next-step-grid">{nextSteps.map(([title, description, href], index) => <Link className="next-step-card" href={href} key={title}><span className="step-number">0{index + 1}</span><h3>{title}</h3><p>{description}</p><span className="coming-next">Coming next <span>↗</span></span></Link>)}</div></section>;
}
