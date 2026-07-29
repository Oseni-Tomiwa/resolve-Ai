'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { apiRequest } from '../api-client';

type Organization = { id: string; name: string };
type Workspace = { id: string; name: string; organizationId: string };
type WidgetResponse = { configuration: { publicId: string; enabled: boolean } | null };

async function resolveWorkspaceWidget(): Promise<string> {
  const organizationId = window.localStorage.getItem('resolveai.organizationId');
  const workspaceId = window.localStorage.getItem('resolveai.workspaceId');
  const organizations = await apiRequest<Organization[]>('/organizations');
  const organization = organizations.find((item) => item.id === organizationId) ?? organizations[0];
  if (!organization) throw new Error('Sign in and select a workspace before opening the widget demo.');
  const workspaces = await apiRequest<Workspace[]>(`/organizations/${organization.id}/workspaces`);
  const workspace = workspaces.find((item) => item.id === workspaceId) ?? workspaces[0];
  if (!workspace) throw new Error('The selected organization has no accessible workspace.');
  window.localStorage.setItem('resolveai.organizationId', organization.id);
  window.localStorage.setItem('resolveai.workspaceId', workspace.id);
  const widget = await apiRequest<WidgetResponse>(`/workspaces/${workspace.id}/widget`);
  const publicId = widget.configuration?.publicId;
  if (!publicId) throw new Error('Configure a public widget for this workspace before opening the demo.');
  return publicId;
}

export default function WidgetDemo() {
  const [widgetId, setWidgetId] = useState('');
  const [error, setError] = useState('');
  const [initializationError, setInitializationError] = useState('');
  const [diagnostic, setDiagnostic] = useState({ configStatus: 'pending', enabled: 'unknown', origin: 'pending' });
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

  useEffect(() => {
    const requestedWidgetId = new URLSearchParams(window.location.search).get('widgetId')?.trim() ?? '';
    if (requestedWidgetId) { setWidgetId(requestedWidgetId); return; }
    let cancelled = false;
    void resolveWorkspaceWidget().then((publicId) => { if (!cancelled) setWidgetId(publicId); }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load the workspace widget.'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleStatus = (event: Event) => { const detail = (event as CustomEvent<{ publicId?: string; status?: string; enabled?: boolean; origin?: string }>).detail; if (detail?.publicId && detail.publicId === widgetId) setDiagnostic({ configStatus: detail.status ?? 'unknown', enabled: detail.enabled === undefined ? 'unknown' : String(detail.enabled), origin: detail.origin ?? 'pending' }); };
    const handleWidgetError = (event: Event) => { const detail = (event as CustomEvent<{ publicId?: string; message?: string }>).detail; if (!detail?.publicId || detail.publicId === widgetId) setInitializationError(detail.message ?? 'The widget could not initialize.'); };
    window.addEventListener('resolveai-widget-status', handleStatus);
    window.addEventListener('resolveai-widget-error', handleWidgetError);
    return () => { window.removeEventListener('resolveai-widget-status', handleStatus); window.removeEventListener('resolveai-widget-error', handleWidgetError); };
  }, [widgetId]);

  return <main style={{ minHeight: '100vh', padding: '80px 24px', color: '#eef2ff', background: '#080b14', fontFamily: 'system-ui, sans-serif' }}><div style={{ maxWidth: 760, margin: '0 auto' }}><p style={{ color: '#7ce7dc', letterSpacing: '.12em', textTransform: 'uppercase', fontSize: 12 }}>External customer site demo</p><h1 style={{ marginTop: 14, fontSize: 48, letterSpacing: '-.06em' }}>Your customer experience, with a calmer answer.</h1><p style={{ marginTop: 18, color: '#a8b0c6', lineHeight: 1.7 }}>This page intentionally embeds ResolveAI as a third-party website would. Use the floating launcher to test a public, workspace-scoped support conversation.</p>{widgetId && <dl aria-label="Widget diagnostics" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 18px', marginTop: 28, padding: 18, border: '1px solid #ffffff1f', borderRadius: 16, color: '#a8b0c6', fontSize: 13 }}><dt>Resolved public ID</dt><dd style={{ margin: 0, color: '#eef2ff' }}>{widgetId}</dd><dt>API origin</dt><dd style={{ margin: 0, color: '#eef2ff' }}>{apiUrl}</dd><dt>Config request</dt><dd style={{ margin: 0, color: '#eef2ff' }}>{diagnostic.configStatus}</dd><dt>Enabled</dt><dd style={{ margin: 0, color: '#eef2ff' }}>{diagnostic.enabled}</dd><dt>Origin validation</dt><dd style={{ margin: 0, color: '#eef2ff' }}>{diagnostic.origin}</dd></dl>}{(error || initializationError) && <p role="alert" style={{ marginTop: 24, color: '#ffb7c4' }}>Widget demo error: {error || initializationError}</p>}</div>{widgetId && <Script key={widgetId} src="/widget.js" data-resolveai-widget-id={widgetId} data-resolveai-api={apiUrl} data-resolveai-open="true" data-resolveai-question="What can you help me with?" onError={() => setInitializationError('widget.js failed to load.')} strategy="afterInteractive" />}</main>;
}
