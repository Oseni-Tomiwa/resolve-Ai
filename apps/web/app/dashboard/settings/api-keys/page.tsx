'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../../../api-client';
import { useDashboard } from '../../dashboard-context';

type ApiKey = { id: string; name: string; prefix: string; scopes: string[]; revokedAt?: string | null };
const scopes = ['knowledge:read', 'knowledge:write', 'conversations:read', 'conversations:write', 'agents:read', 'widget:read', 'analytics:read'];

export default function ApiKeysPage() {
  const { currentWorkspace, loading } = useDashboard();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>(['knowledge:read']);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => { if (currentWorkspace) setKeys(await apiRequest<ApiKey[]>(`/workspaces/${currentWorkspace.id}/api-keys`)); };
  useEffect(() => { void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load API keys.')); }, [currentWorkspace]);
  const create = async (event: FormEvent) => { event.preventDefault(); if (!currentWorkspace) return; try { const result = await apiRequest<{ key: string }>(`/workspaces/${currentWorkspace.id}/api-keys`, { method: 'POST', body: JSON.stringify({ name, scopes: selected }) }); setSecret(result.key); setName(''); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create API key.'); } };
  const revoke = async (id: string) => { if (!currentWorkspace) return; await apiRequest(`/workspaces/${currentWorkspace.id}/api-keys/${id}`, { method: 'DELETE' }); await load(); };
  if (loading || !currentWorkspace) return <section className="settings-page"><p>Loading workspace…</p></section>;
  return <section className="settings-page"><p className="eyebrow">Developer access</p><h2>API keys</h2><p>Create scoped server-to-server keys. The secret is shown once.</p><form onSubmit={create} className="settings-summary"><label>Name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label><fieldset><legend>Scopes</legend>{scopes.map((scope) => <label key={scope}><input type="checkbox" checked={selected.includes(scope)} onChange={(event) => setSelected((value) => event.target.checked ? [...value, scope] : value.filter((item) => item !== scope))} />{scope}</label>)}</fieldset><button type="submit">Create key</button></form>{secret && <p role="status">Copy this key now: <code>{secret}</code></p>}{error && <p role="alert">{error}</p>}<ul>{keys.map((key) => <li key={key.id}><strong>{key.name}</strong> <code>{key.prefix}_••••</code> {key.revokedAt ? 'Revoked' : <button type="button" onClick={() => void revoke(key.id)}>Revoke</button>}</li>)}</ul></section>;
}
