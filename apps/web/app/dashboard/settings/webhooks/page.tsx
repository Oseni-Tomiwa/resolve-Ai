'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../../../api-client';
import { useDashboard } from '../../dashboard-context';

type Webhook = { id: string; name: string; url: string; enabled: boolean };
const events = ['conversation.created', 'conversation.updated', 'message.created', 'document.ready', 'document.failed', 'agent.published', 'member.updated', 'billing.updated'];

export default function WebhooksPage() {
  const { currentWorkspace, loading } = useDashboard(); const [hooks, setHooks] = useState<Webhook[]>([]); const [name, setName] = useState(''); const [url, setUrl] = useState(''); const [event, setEvent] = useState(events[0]); const [secret, setSecret] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = async () => { if (currentWorkspace) setHooks(await apiRequest<Webhook[]>(`/workspaces/${currentWorkspace.id}/webhooks`)); }; useEffect(() => { void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load webhooks.')); }, [currentWorkspace]);
  const create = async (formEvent: FormEvent) => { formEvent.preventDefault(); if (!currentWorkspace) return; try { const result = await apiRequest<{ secret: string }>(`/workspaces/${currentWorkspace.id}/webhooks`, { method: 'POST', body: JSON.stringify({ name, url, events: [event] }) }); setSecret(result.secret); setName(''); setUrl(''); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create webhook.'); } };
  const toggle = async (hook: Webhook) => { if (currentWorkspace) { await apiRequest(`/workspaces/${currentWorkspace.id}/webhooks/${hook.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !hook.enabled }) }); await load(); } };
  const remove = async (id: string) => { if (currentWorkspace) { await apiRequest(`/workspaces/${currentWorkspace.id}/webhooks/${id}`, { method: 'DELETE' }); await load(); } };
  if (loading || !currentWorkspace) return <section className="settings-page"><p>Loading workspace…</p></section>;
  return <section className="settings-page"><p className="eyebrow">Developer access</p><h2>Outbound webhooks</h2><p>Receive signed workspace events at a public HTTPS endpoint.</p><form onSubmit={create} className="settings-summary"><label>Name<input value={name} onChange={(formEvent) => setName(formEvent.target.value)} required /></label><label>Endpoint<input type="url" value={url} onChange={(formEvent) => setUrl(formEvent.target.value)} placeholder="https://example.com/hooks" required /></label><label>Event<select value={event} onChange={(formEvent) => setEvent(formEvent.target.value)}>{events.map((item) => <option key={item}>{item}</option>)}</select></label><button type="submit">Create webhook</button></form>{secret && <p role="status">Copy this signing secret now: <code>{secret}</code></p>}{error && <p role="alert">{error}</p>}<ul>{hooks.map((hook) => <li key={hook.id}><strong>{hook.name}</strong> {hook.enabled ? 'Enabled' : 'Disabled'} <button type="button" onClick={() => void toggle(hook)}>{hook.enabled ? 'Disable' : 'Enable'}</button> <button type="button" onClick={() => void remove(hook.id)}>Delete</button></li>)}</ul></section>;
}
