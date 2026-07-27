'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../dashboard-context';

type Conversation = { id: string; workspaceId: string; title: string; lastMessageAt: string; createdAt: string; status: string };
type Agent = { id: string; name: string; description: string | null; isDefault: boolean; status: string };
type Page = { items: Conversation[]; page: number; pageSize: number; total: number; hasMore: boolean };
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json() as { success: boolean; message?: string; data?: T };
  if (!response.ok || !body.success || body.data === undefined) throw new Error(body.message ?? 'Unable to load conversations.');
  return body.data;
}

const formatDate = (value: string): string => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

export default function ConversationsPage() {
  const router = useRouter();
  const { currentWorkspace, loading: workspaceLoading, error: workspaceError, reload } = useDashboard();
  const [page, setPage] = useState<Page | null>(null);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true); setError('');
    try { setPage(await api<Page>(`/workspaces/${currentWorkspace.id}/ai/conversations?page=1&pageSize=20${activeSearch ? `&search=${encodeURIComponent(activeSearch)}` : ''}`)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load conversations.'); } finally { setLoading(false); }
  }, [activeSearch, currentWorkspace]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!currentWorkspace) return; void api<{ items: Agent[] }>(`/workspaces/${currentWorkspace.id}/ai/agents?page=1&pageSize=50`).then((result) => { setAgents(result.items); setSelectedAgentId((current) => current || result.items.find((agent) => agent.isDefault)?.id || result.items[0]?.id || ''); }).catch(() => setAgents([])); }, [currentWorkspace]);

  async function create(): Promise<void> {
    if (!currentWorkspace) return;
    try { const conversation = await api<Conversation>(`/workspaces/${currentWorkspace.id}/ai/conversations`, { method: 'POST', body: JSON.stringify({ ...(selectedAgentId ? { agentId: selectedAgentId } : {}) }) }); router.push(`/dashboard/conversations/${conversation.id}`); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create conversation.'); }
  }
  async function rename(conversationId: string): Promise<void> {
    if (!currentWorkspace || !editTitle.trim()) return;
    try { await api<Conversation>(`/workspaces/${currentWorkspace.id}/ai/conversations/${conversationId}`, { method: 'PATCH', body: JSON.stringify({ title: editTitle.trim() }) }); setEditing(null); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to rename conversation.'); }
  }
  async function remove(conversationId: string): Promise<void> {
    if (!currentWorkspace) return;
    try { await api<null>(`/workspaces/${currentWorkspace.id}/ai/conversations/${conversationId}`, { method: 'DELETE' }); setConfirming(null); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete conversation.'); }
  }
  function submitSearch(event: FormEvent<HTMLFormElement>): void { event.preventDefault(); setActiveSearch(search.trim()); }

  return <section className="conversation-page">
    <div className="conversation-heading"><div><p className="eyebrow">Workspace AI</p><h2>Conversations</h2><p>Ask questions grounded in {currentWorkspace?.name ?? 'your workspace'} and keep the context for later.</p></div><button className="button button-small" type="button" onClick={() => void create()} disabled={!currentWorkspace || workspaceLoading}>New conversation <span aria-hidden="true">↗</span></button></div>
    {workspaceLoading && <p className="dashboard-inline-status" role="status">Loading your workspace…</p>}
    {workspaceError && <div className="dashboard-error" role="alert"><span>{workspaceError}</span><button type="button" onClick={() => void reload()}>Try again</button></div>}
    {!workspaceLoading && currentWorkspace && <><form className="conversation-search" onSubmit={submitSearch}><label htmlFor="conversation-search">Search conversations</label><div><input id="conversation-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title" maxLength={100} /><button className="button button-small" type="submit">Search</button></div></form>{agents.length > 0 && <label className="conversation-agent-picker" htmlFor="conversation-agent">Agent for new conversations<select id="conversation-agent" value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)}>{agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}{agent.isDefault ? ' · Default' : ''}</option>)}</select><small>{agents.find((agent) => agent.id === selectedAgentId)?.description ?? 'The workspace default will be used when no agent is selected.'}</small></label>}</>}
    {error && <div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div>}
    {loading && <p className="dashboard-inline-status" role="status">Loading conversation history…</p>}
    {!loading && page?.items.length === 0 && <div className="empty-state conversation-empty"><div className="empty-state-icon">✦</div><p className="eyebrow">Conversation history</p><h2>Start with a question.</h2><p className="empty-state-description">Create a conversation to keep grounded answers, follow-ups, and citations together.</p><button className="button button-small" type="button" onClick={() => void create()}>New conversation <span>↗</span></button></div>}
    {!loading && page && page.items.length > 0 && <div className="conversation-list" aria-label="Conversation history">{page.items.map((conversation) => <article className="conversation-list-item" key={conversation.id}><Link href={`/dashboard/conversations/${conversation.id}`}><span className="conversation-list-icon">✦</span><span><strong>{conversation.title}</strong><small>Updated {formatDate(conversation.lastMessageAt)}</small></span></Link>{editing === conversation.id ? <form className="conversation-edit" onSubmit={(event) => { event.preventDefault(); void rename(conversation.id); }}><input aria-label="Conversation title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={120} autoFocus /><button type="submit">Save</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></form> : confirming === conversation.id ? <div className="conversation-actions" role="group" aria-label="Confirm conversation deletion"><span>Delete history?</span><button type="button" onClick={() => void remove(conversation.id)}>Confirm</button><button type="button" onClick={() => setConfirming(null)}>Cancel</button></div> : <div className="conversation-actions"><button type="button" onClick={() => { setEditing(conversation.id); setEditTitle(conversation.title); }}>Rename</button><button type="button" onClick={() => setConfirming(conversation.id)}>Delete</button></div>}</article>)}</div>}
  </section>;
}
