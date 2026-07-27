'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useDashboard } from '../dashboard-context';

type Agent = { id: string; name: string; description: string | null; model: string; status: 'DRAFT' | 'ACTIVE' | 'DISABLED'; isDefault: boolean; updatedAt: string };
type AgentPage = { items: Agent[]; total: number };
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json() as { success: boolean; message?: string; data?: T };
  if (!response.ok || !body.success || body.data === undefined) throw new Error(body.message ?? 'Unable to load agents.');
  return body.data;
}

const statusLabel = (status: Agent['status']): string => status === 'ACTIVE' ? 'Active' : status === 'DISABLED' ? 'Disabled' : 'Draft';
const formatDate = (value: string): string => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));

export default function AiAgent() {
  const { currentWorkspace, organizationRole, workspaceRole, loading: workspaceLoading, error: workspaceError, reload } = useDashboard();
  const [agents, setAgents] = useState<AgentPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canManage = organizationRole === 'OWNER' || organizationRole === 'ADMIN' || workspaceRole === 'ADMIN';
  const load = useCallback(async () => { if (!currentWorkspace) return; setLoading(true); setError(''); try { setAgents(await api<AgentPage>(`/workspaces/${currentWorkspace.id}/ai/agents?page=1&pageSize=50`)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load agents.'); } finally { setLoading(false); } }, [currentWorkspace]);
  useEffect(() => { void load(); }, [load]);

  async function toggle(agent: Agent): Promise<void> { if (!currentWorkspace) return; setError(''); try { const next = agent.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'; await api<Agent>(`/workspaces/${currentWorkspace.id}/ai/agents/${agent.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update this agent.'); } }
  async function setDefault(agent: Agent): Promise<void> { if (!currentWorkspace) return; setError(''); try { await api<Agent>(`/workspaces/${currentWorkspace.id}/ai/agents/${agent.id}/set-default`, { method: 'POST', body: '{}' }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to set the default agent.'); } }
  async function remove(agent: Agent): Promise<void> { if (!currentWorkspace || !window.confirm(`Delete ${agent.name}? Existing conversations remain readable.`)) return; setError(''); try { await api<null>(`/workspaces/${currentWorkspace.id}/ai/agents/${agent.id}`, { method: 'DELETE' }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete this agent.'); } }

  if (workspaceLoading) return <section className="agent-page"><p className="dashboard-inline-status" role="status">Loading your workspace…</p></section>;
  if (workspaceError) return <section className="agent-page"><div className="dashboard-error" role="alert"><span>{workspaceError}</span><button type="button" onClick={() => void reload()}>Try again</button></div></section>;
  return <section className="agent-page"><div className="agent-heading"><div><p className="eyebrow">Workspace AI</p><h2>AI Agent Builder</h2><p>Configure the support voice that answers from {currentWorkspace?.name ?? 'your workspace'} knowledge.</p></div>{canManage && <Link className="button button-small" href="/dashboard/ai-agent/new">Create agent <span>↗</span></Link>}</div>{error && <div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div>}{loading && <p className="dashboard-inline-status" role="status">Loading agents…</p>}{!loading && agents?.items.length === 0 && <div className="empty-state"><div className="empty-state-icon">✦</div><p className="eyebrow">Workspace agent</p><h2>No agents yet.</h2><p className="empty-state-description">Create a grounded support agent with a clear identity and safe behavior.</p>{canManage && <Link className="button button-small" href="/dashboard/ai-agent/new">Create your first agent <span>↗</span></Link>}</div>}{!loading && agents && agents.items.length > 0 && <div className="agent-list">{agents.items.map((agent) => <article className="agent-card" key={agent.id}><div className="agent-card-top"><div className="agent-avatar">✦</div><div><div className="agent-card-title"><h3>{agent.name}</h3>{agent.isDefault && <span className="agent-badge default">Default</span>}</div><p>{agent.description ?? 'No description added.'}</p></div><span className={`agent-badge ${agent.status.toLowerCase()}`}>{statusLabel(agent.status)}</span></div><div className="agent-card-meta"><span>Model <strong>{agent.model}</strong></span><span>Updated <strong>{formatDate(agent.updatedAt)}</strong></span></div><div className="agent-card-actions"><Link className="text-link" href={`/dashboard/ai-agent/${agent.id}`}>Edit configuration</Link>{canManage && <><button type="button" onClick={() => void toggle(agent)} disabled={agent.isDefault && agent.status === 'ACTIVE'}>{agent.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button>{!agent.isDefault && agent.status === 'ACTIVE' && <button type="button" onClick={() => void setDefault(agent)}>Set default</button>}{!agent.isDefault && <button type="button" onClick={() => void remove(agent)}>Delete</button>}</>}</div></article>)}</div>}</section>;
}
