'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type OnboardingInput } from '../auth-provider';

const slugify = (value: string): string => value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-');
const industries = [['SAAS', 'SaaS'], ['ECOMMERCE', 'Ecommerce'], ['FINANCIAL_SERVICES', 'Financial services'], ['EDUCATION', 'Education'], ['HEALTHCARE', 'Healthcare'], ['PROFESSIONAL_SERVICES', 'Professional services'], ['OTHER', 'Other']];
const teamSizes = [['JUST_ME', 'Just me'], ['TWO_TO_TEN', '2–10'], ['ELEVEN_TO_FIFTY', '11–50'], ['FIFTY_ONE_TO_TWO_HUNDRED', '51–200'], ['TWO_HUNDRED_PLUS', '201+']];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, onboarding, loading, createOnboarding } = useAuth();
  const [values, setValues] = useState<OnboardingInput>({ organizationName: '', organizationSlug: '', workspaceName: 'Customer Support', workspaceSlug: 'customer-support', industry: 'SAAS', teamSize: 'JUST_ME' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!loading && !user) router.replace('/login'); else if (!loading && onboarding && !onboarding.required) router.replace('/dashboard'); }, [loading, onboarding, router, user]);
  function update(field: keyof OnboardingInput, value: string): void { setValues((current) => ({ ...current, [field]: value })); setError(''); }
  function submit(event: FormEvent<HTMLFormElement>): void { event.preventDefault(); if (values.organizationName.trim().length < 2 || values.workspaceName.trim().length < 2) { setError('Please provide an organization and workspace name.'); return; } setSubmitting(true); void createOnboarding({ ...values, organizationName: values.organizationName.trim(), organizationSlug: values.organizationSlug || slugify(values.organizationName), workspaceName: values.workspaceName.trim(), workspaceSlug: values.workspaceSlug || slugify(values.workspaceName) }).then(() => router.replace('/dashboard')).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to create your workspace.')).finally(() => setSubmitting(false)); }
  if (loading || user === null || (onboarding && !onboarding.required)) return <main className="onboarding-shell"><div className="auth-loading">Preparing your workspace…</div></main>;
  return <main className="onboarding-shell"><div className="onboarding-brand"><Link className="brand" href="/"><span className="brand-mark">R</span><span>resolve<span className="brand-accent">ai</span></span></Link><span>Step 1 of 1</span></div><section className="onboarding-card"><div className="progress-track"><span /></div><p className="eyebrow">Welcome, {user.firstName}</p><h1>Build your first support workspace.</h1><p className="onboarding-lede">An organization is your company. A workspace is the focused support environment your team will use inside it.</p><form onSubmit={submit} noValidate><div className="onboarding-grid"><label>Organization name<input required value={values.organizationName} onChange={(event) => { update('organizationName', event.target.value); update('organizationSlug', slugify(event.target.value)); }} placeholder="Mavery Innovative Systems" /></label><label>Organization slug<input required value={values.organizationSlug} onChange={(event) => update('organizationSlug', event.target.value)} aria-describedby="org-slug-help" /><small id="org-slug-help">Your unique ResolveAI address.</small></label><label>Workspace name<input required value={values.workspaceName} onChange={(event) => { update('workspaceName', event.target.value); update('workspaceSlug', slugify(event.target.value)); }} placeholder="Customer Support" /></label><label>Workspace slug<input required value={values.workspaceSlug} onChange={(event) => update('workspaceSlug', event.target.value)} /></label><label>Industry<select value={values.industry} onChange={(event) => update('industry', event.target.value)}>{industries.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Team size<select value={values.teamSize} onChange={(event) => update('teamSize', event.target.value)}>{teamSizes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button auth-submit" type="submit" disabled={submitting}>{submitting ? 'Creating workspace…' : 'Create workspace'} <span aria-hidden="true">↗</span></button></form></section></main>;
}
