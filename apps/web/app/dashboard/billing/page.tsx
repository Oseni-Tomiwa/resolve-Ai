'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api-client';
import { useDashboard } from '../dashboard-context';

type Plan = 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
type Usage = { periodStart: string; periodEnd: string; plan: Plan; limits: Record<string, number | null>; values: { aiRequests: number; tokens: number; inputTokens: number; outputTokens: number; conversations: number; documents: number; storageBytes: number; teamMembers: number } };
type Billing = { subscription: { plan: Plan; status: string; trialEndsAt: string | null; currentPeriodEnd: string; renewalDate: string | null; seats: number; provider: string; providerCustomerId: string | null }; usage: Usage };

const plans: Array<{ id: Plan; name: string; price: string; description: string; features: string[] }> = [
  { id: 'FREE', name: 'Free', price: '$0', description: 'A simple starting point for small teams.', features: ['100 AI requests / month', '10 documents', '3 team members'] },
  { id: 'PRO', name: 'Pro', price: '$99', description: 'Higher limits for serious customer support.', features: ['10,000 AI requests / month', '1,000 documents', '50 team members'] },
  { id: 'BUSINESS', name: 'Business', price: '$249', description: 'Scale support operations across larger teams.', features: ['50,000 AI requests / month', '5,000 documents', '250 team members'] },
];
const labels: Array<[keyof Usage['values'], string, string]> = [['aiRequests', 'AI requests', 'aiRequests'], ['tokens', 'Tokens', 'tokens'], ['conversations', 'Conversations', 'conversations'], ['documents', 'Documents', 'documents'], ['storageBytes', 'Storage', 'storageBytes'], ['teamMembers', 'Team members', 'teamMembers']];
const formatValue = (key: string, value: number): string => key === 'storageBytes' ? `${(value / (1024 * 1024)).toFixed(value > 1024 * 1024 * 1024 ? 1 : 0)} MB` : value.toLocaleString();

export default function BillingPage() {
  const { currentWorkspace, loading: workspaceLoading, error: workspaceError } = useDashboard();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load(): Promise<void> {
    if (!currentWorkspace) return;
    setLoading(true); setError('');
    try { setBilling(await apiRequest<Billing>(`/workspaces/${currentWorkspace.id}/billing`)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load billing.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (workspaceLoading) return; if (!currentWorkspace) { setBilling(null); setLoading(false); return; } void load(); }, [currentWorkspace, workspaceLoading]);
  useEffect(() => { const billingResult = new URLSearchParams(window.location.search).get('billing'); if (billingResult === 'success') setMessage('Checkout completed. Stripe will confirm your subscription shortly.'); if (billingResult === 'cancelled') setMessage('Checkout was cancelled; your current plan is unchanged.'); }, []);
  const currentPlan = billing?.subscription.plan ?? 'FREE';
  const period = useMemo(() => billing ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(billing.usage.periodStart)) : '', [billing]);
  async function upgrade(plan: Plan): Promise<void> {
    if (!currentWorkspace || plan === currentPlan) return;
    if (plan === 'FREE' && !window.confirm('Downgrade this workspace at the end of the current billing period?')) return;
    setSaving(plan); setError(''); setMessage('');
    try {
      if (plan === 'FREE' || billing?.subscription.provider !== 'stripe') {
        await apiRequest(`/workspaces/${currentWorkspace.id}/billing/plan`, { method: 'PATCH', body: JSON.stringify({ plan }) });
        setMessage('Your workspace is now on the free plan.');
        await load();
      } else {
        const checkout = await apiRequest<{ checkoutUrl: string }>(`/workspaces/${currentWorkspace.id}/billing/checkout-session`, { method: 'POST', body: JSON.stringify({ plan }) });
        window.location.assign(checkout.checkoutUrl);
      }
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to change plan.'); }
    finally { setSaving(null); }
  }
  if (workspaceLoading || loading) return <section className="billing-page"><p className="dashboard-inline-status">Loading billing…</p></section>;
  if (workspaceError) return <section className="billing-page"><div className="dashboard-error" role="alert">{workspaceError}</div></section>;
  if (!billing) return <section className="billing-page"><div className="dashboard-error" role="alert">{error || 'Billing is not available for this workspace.'}<button type="button" onClick={() => void load()}>Try again</button></div></section>;
  async function openPortal(): Promise<void> {
    if (!currentWorkspace) return;
    setError('');
    try { const portal = await apiRequest<{ portalUrl: string }>(`/workspaces/${currentWorkspace.id}/billing/portal-session`, { method: 'POST' }); window.location.assign(portal.portalUrl); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to open the billing portal.'); }
  }
  const currentPlanName = plans.find((plan) => plan.id === currentPlan)?.name ?? currentPlan;
  return <section className="billing-page">
    <div className="billing-heading"><div><p className="eyebrow">Workspace billing</p><h2>Plans that scale with your support team</h2><p>Usage is measured per workspace and resets at the start of each month.</p></div><div className="billing-heading-actions"><span className="billing-plan-badge">{currentPlanName}</span>{billing.subscription.provider === 'stripe' && billing.subscription.providerCustomerId && <button className="button button-ghost button-small" type="button" onClick={() => void openPortal()}>Manage billing</button>}</div></div>
    {(error || message) && <div className={error ? 'dashboard-error' : 'billing-success'} role={error ? 'alert' : 'status'}>{error || message}</div>}
    <div className="billing-summary"><div><span>Current plan</span><strong>{plans.find((plan) => plan.id === currentPlan)?.name}</strong><small>{billing.subscription.status.toLowerCase()} · {billing.subscription.provider === 'mock' ? 'development billing' : 'Stripe billing'}</small></div><div><span>Renewal</span><strong>{billing.subscription.renewalDate ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(billing.subscription.renewalDate)) : 'Not scheduled'}</strong><small>{period} usage period</small></div><div><span>Seats</span><strong>{billing.usage.values.teamMembers}{billing.usage.limits.teamMembers === null ? '' : ` / ${billing.usage.limits.teamMembers}`}</strong><small>Active workspace members</small></div></div>
    <div className="section-heading billing-section-heading"><div><p className="eyebrow">Monthly usage</p><h3>Keep an eye on what you use</h3></div><span className="section-hint">{period}</span></div>
    <div className="usage-grid">{labels.map(([key, label, limitKey]) => { const value = billing.usage.values[key]; const limit = billing.usage.limits[limitKey] ?? null; const percent = limit === null ? 0 : Math.min(100, (value / limit) * 100); const warning = limit !== null && percent >= 80; return <div className="usage-card" key={key}><div><span>{label}</span><strong>{formatValue(key, value)}</strong></div><div className="usage-track" aria-label={`${label} usage`}><i className={warning ? 'warning' : ''} style={{ width: limit === null ? '12%' : `${percent}%` }} /></div><small>{limit === null ? 'Unlimited' : `${formatValue(key, limit)} included`}{warning && ' · nearing limit'}</small></div>; })}</div>
    <div className="section-heading billing-section-heading"><div><p className="eyebrow">Choose a plan</p><h3>Compare plans</h3></div><span className="section-hint">{billing.subscription.provider === 'stripe' ? 'Secure Stripe billing' : 'Development billing'}</span></div>
    <div className="plan-grid">{plans.map((plan) => <article className={`plan-card ${plan.id === currentPlan ? 'current' : ''}`} key={plan.id}><div className="plan-card-top"><div><span className="plan-name">{plan.name}</span><strong>{plan.price}{plan.id !== 'FREE' && <small>/month</small>}</strong></div>{plan.id === currentPlan && <span className="current-label">Current</span>}</div><p>{plan.description}</p><ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul><button className="button button-small" type="button" disabled={plan.id === currentPlan || saving !== null} onClick={() => void upgrade(plan.id)}>{saving === plan.id ? 'Opening checkout…' : plan.id === currentPlan ? 'Active plan' : plan.id === 'FREE' ? 'Downgrade' : 'Choose plan'}</button></article>)}</div>
    <div className="invoice-placeholder"><div><p className="eyebrow">Invoices</p><h3>Invoice history</h3><p>{billing.subscription.provider === 'stripe' ? 'Invoices and receipts are managed securely in the Stripe customer portal.' : 'Invoice history becomes available when Stripe billing is enabled for this workspace.'}</p></div>{billing.subscription.provider === 'stripe' && billing.subscription.providerCustomerId ? <button className="button button-ghost button-small" type="button" onClick={() => void openPortal()}>View invoices</button> : <span>{billing.subscription.provider === 'mock' ? 'Development billing' : 'Not available'}</span>}</div>
  </section>;
}
