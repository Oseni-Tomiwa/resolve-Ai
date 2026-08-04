'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest } from '../../api-client';
import { useDashboard } from '../dashboard-context';

type Item = {
  id: string;
  title: string | null;
  status: string;
  mode: string;
  priority: string;
  source?: string | null;
  unread: boolean;
  lastMessageAt?: string | null;
  lastMessage?: { role: string; content: string } | null;
  assignedUser?: { firstName: string; lastName: string } | null;
};
type Detail = Item & { messages: Array<{ id: string; role: string; content: string; createdAt: string }>; notes: Array<{ id: string; content: string; author: { firstName: string; lastName: string } }> };
type List = { items: Item[]; unreadCount: number; canManage: boolean };

const titleFor = (item: Item): string => item.title?.trim() || 'Visitor conversation';
const previewFor = (item: Item): string => item.lastMessage?.content?.trim() || 'No messages yet';
const statusFor = (value: string): string => value.toLowerCase().replace(/_/g, ' ');
const dateFor = (value?: string | null): string => {
  if (!value) return 'No recent activity';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No recent activity' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
};
const initialsFor = (user?: { firstName: string; lastName: string } | null): string => user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() || '—' : '—';

export default function InboxPage() {
  const { currentWorkspace, loading: workspaceLoading, error: workspaceError, reload } = useDashboard();
  const [list, setList] = useState<List | null>(null);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const threadRequest = useRef(0);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [status, setStatus] = useState('');
  const [assignment, setAssignment] = useState('all');
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentWorkspace) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (assignment !== 'all') params.set('assignment', assignment);
      if (activeSearch) params.set('search', activeSearch);
      const query = params.toString();
      const value = await apiRequest<List>(`/workspaces/${currentWorkspace.id}/inbox${query ? `?${query}` : ''}`);
      setList(value);
      const currentSelection = selectedIdRef.current;
      if (currentSelection && !value.items.some((item) => item.id === currentSelection)) {
        selectedIdRef.current = null;
        setSelectedId(null);
        setSelected(null);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load the inbox.'); }
    finally { setLoading(false); }
  }, [activeSearch, assignment, currentWorkspace, status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 5000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  async function select(id: string): Promise<void> {
    if (!currentWorkspace) return;
    const request = ++threadRequest.current;
    selectedIdRef.current = id;
    setSelectedId(id);
    setSelected(null);
    setThreadLoading(true);
    setThreadError('');
    try {
      const value = await apiRequest<Detail>(`/workspaces/${currentWorkspace.id}/inbox/${id}`);
      if (request !== threadRequest.current || selectedIdRef.current !== id) return;
      setSelected(value);
      setThreadLoading(false);
      setList((current) => current ? { ...current, unreadCount: Math.max(0, current.unreadCount - (current.items.find((item) => item.id === id)?.unread ? 1 : 0)), items: current.items.map((item) => item.id === id ? { ...item, unread: false } : item) } : current);
      void apiRequest(`/workspaces/${currentWorkspace.id}/inbox/${id}/read`, { method: "POST" }).catch(() => undefined);
    } catch (caught) {
      if (request !== threadRequest.current || selectedIdRef.current !== id) return;
      setThreadLoading(false);
      setThreadError(caught instanceof Error ? caught.message : 'Unable to open this conversation.');
    }
  }
  async function action(path: string, init?: RequestInit): Promise<void> {
    if (!currentWorkspace || !selected || threadLoading) return;
    setBusy(true); setError('');
    try { await apiRequest(`/workspaces/${currentWorkspace.id}/inbox/${selected.id}${path}`, init); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Inbox action failed.'); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent, kind: 'reply' | 'note'): Promise<void> {
    event.preventDefault();
    const content = kind === 'reply' ? reply : note;
    if (!content.trim()) return;
    await action(kind === 'reply' ? '/messages' : '/notes', { method: 'POST', body: JSON.stringify({ content }) });
    if (kind === 'reply') setReply(''); else setNote('');
  }

  if (workspaceLoading) return <section className="team-page"><p className="dashboard-inline-status">Loading your workspace…</p></section>;
  if (workspaceError) return <section className="team-page"><div className="dashboard-error" role="alert"><span>{workspaceError}</span><button type="button" onClick={() => void reload()}>Try again</button></div></section>;

  return <section className="team-page inbox-page">
    <div className="knowledge-intro inbox-heading"><div><p className="eyebrow">Customer support</p><h2>Inbox</h2><p>Take over visitor conversations when a human should step in.</p></div><span className="section-hint">{list?.unreadCount ?? 0} unread</span></div>
    {error && <div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div>}
    <div className={`inbox-layout${selectedId ? ' has-selection' : ''}`}>
      <aside className="inbox-list" aria-label="Inbox conversations">
        <form className="knowledge-search-row inbox-search" onSubmit={(event) => { event.preventDefault(); setActiveSearch(search.trim()); }}>
          <label className="visually-hidden" htmlFor="inbox-search">Search inbox</label>
          <input id="inbox-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" />
          <button className="button button-small" type="submit">Search</button>
        </form>
        <div className="knowledge-filters inbox-filters">
          <label className="visually-hidden" htmlFor="inbox-status">Filter status</label>
          <select id="inbox-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="OPEN">Open</option><option value="PENDING">Pending</option><option value="RESOLVED">Resolved</option></select>
          <label className="visually-hidden" htmlFor="inbox-assignment">Filter assignment</label>
          <select id="inbox-assignment" value={assignment} onChange={(event) => setAssignment(event.target.value)}><option value="all">All assignments</option><option value="mine">Assigned to me</option><option value="unassigned">Unassigned</option></select>
        </div>
        {loading && !list ? <div className="inbox-skeletons" aria-label="Loading inbox"><i /><i /><i /><i /></div> : list?.items.length ? <div className="inbox-row-list">{list.items.map((item) => <button className={`inbox-row${selectedId === item.id ? ' active' : ''}${item.unread ? ' unread' : ''}`} key={item.id} type="button" onClick={() => void select(item.id)} aria-current={selectedId === item.id ? 'true' : undefined}>
          <span className="inbox-row-main"><strong>{titleFor(item)}</strong><small>{previewFor(item)}</small></span>
          <span className="inbox-row-meta"><span className={`inbox-status status-${item.status.toLowerCase()}`}><span className="status-dot" aria-hidden="true" />{statusFor(item.status)}</span><span className="inbox-assignee">{item.assignedUser ? <><span className="user-avatar" aria-hidden="true">{initialsFor(item.assignedUser)}</span>{item.assignedUser.firstName} {item.assignedUser.lastName}</> : 'Unassigned'}</span><span className="inbox-row-footer"><span>{item.source || item.mode || 'Support'}</span><time dateTime={item.lastMessageAt ?? undefined}>{dateFor(item.lastMessageAt)}</time></span></span>
          {item.unread && <span className="visually-hidden">Unread conversation</span>}
        </button>)}</div> : <div className="knowledge-empty inbox-empty"><h3>{activeSearch || status || assignment !== 'all' ? 'No matching conversations' : 'Inbox is empty'}</h3><p>{activeSearch || status || assignment !== 'all' ? 'Try changing your search or filters.' : 'Visitor messages will appear here.'}</p></div>}
      </aside>
      <main className="inbox-detail" aria-label="Selected conversation">
        {threadLoading ? <div className="inbox-thread-skeleton" aria-label="Loading conversation"><i /><i /><i /></div> : threadError ? <div className="knowledge-empty inbox-detail-empty"><h3>Unable to load conversation</h3><p>{threadError}</p><button className="button button-small" type="button" onClick={() => selectedId && void select(selectedId)}>Try again</button></div> : !selected ? <div className="knowledge-empty inbox-detail-empty"><h3>Select a conversation</h3><p>Choose a conversation from the list to view its messages and take action.</p></div> : <>
          <button className="inbox-back-button text-action" type="button" onClick={() => { selectedIdRef.current = null; setSelectedId(null); setSelected(null); }}>← Back to conversations</button>
          <div className="section-heading inbox-detail-heading"><div><p className="eyebrow">{selected.mode || 'Support'} · {selected.priority || 'Normal'}</p><h3>{titleFor(selected)}</h3><p className="inbox-detail-meta">{selected.assignedUser ? `Assigned to ${selected.assignedUser.firstName} ${selected.assignedUser.lastName}` : 'Unassigned'} · {dateFor(selected.lastMessageAt)}</p></div><div className="inbox-actions"><button className="button button-small" type="button" disabled={busy || selected.mode === 'HUMAN'} onClick={() => void action('/takeover', { method: 'POST' })}>Take over</button><button className="text-action" type="button" disabled={busy || selected.mode === 'AI'} onClick={() => void action('/return-to-ai', { method: 'POST' })}>Return to AI</button><select aria-label="Conversation status" value={selected.status} onChange={(event) => void action('/status', { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) })}><option value="OPEN">Open</option><option value="PENDING">Pending</option><option value="RESOLVED">Resolved</option></select></div></div>
          <div className="inbox-messages">{selected.messages.map((message) => <article className={`inbox-message ${message.role.toLowerCase()}`} key={message.id}><small>{message.role === 'USER' ? 'Visitor' : message.role}</small><p>{message.content || 'No message content.'}</p></article>)}</div>
          <form className="knowledge-search-row inbox-composer" onSubmit={(event) => void submit(event, 'reply')}><label className="visually-hidden" htmlFor="inbox-reply">Reply to visitor</label><input id="inbox-reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply to visitor…" /><button className="button button-small" disabled={busy || selected.mode !== 'HUMAN'}>Send reply</button></form>
          <form className="knowledge-search-row inbox-composer" onSubmit={(event) => void submit(event, 'note')}><label className="visually-hidden" htmlFor="inbox-note">Internal note</label><input id="inbox-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add internal note…" /><button className="text-action" disabled={busy}>Add note</button></form>
          {selected.notes.length > 0 && <div className="inbox-notes"><p className="eyebrow">Internal notes</p>{selected.notes.map((item) => <p key={item.id}><strong>{item.author.firstName} {item.author.lastName}</strong>: {item.content}</p>)}</div>}
        </>}
      </main>
    </div>
  </section>;
}
