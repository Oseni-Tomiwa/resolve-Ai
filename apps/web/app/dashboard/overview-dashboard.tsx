'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../api-client';
import { useDashboard } from './dashboard-context';

type Analytics = { kpis: { totalConversations: number; aiResolved: number; humanHandoffs: number; averageResponseTimeSeconds: number | null; activeDocuments: number; activeAgents: number } };
type ConversationPage = { items: Array<{ id: string; title: string; status: string; lastMessageAt: string }> };
type Document = { id: string; name: string; status: string; createdAt: string };
type DocumentList = { documents: Document[] };
type Member = { user: { id: string; firstName: string; lastName: string; email: string }; role: string };

const formatDate = (value: string): string => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));

export function OverviewDashboard() {
  const { currentWorkspace, loading: workspaceLoading, error: workspaceError, reload } = useDashboard();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [conversations, setConversations] = useState<ConversationPage['items']>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentWorkspace) { setLoading(false); return; }
    setLoading(true); setError('');
    const workspaceId = currentWorkspace.id;
    void Promise.all([
      apiRequest<Analytics>(`/workspaces/${workspaceId}/analytics`),
      apiRequest<ConversationPage>(`/workspaces/${workspaceId}/ai/conversations?page=1&pageSize=4`),
      apiRequest<DocumentList>(`/workspaces/${workspaceId}/knowledge/documents?page=1&pageSize=4`),
      apiRequest<Member[]>(`/workspaces/${workspaceId}/members`),
    ]).then(([nextAnalytics, nextConversations, nextDocuments, nextMembers]) => {
      setAnalytics(nextAnalytics); setConversations(nextConversations.items); setDocuments(nextDocuments.documents); setMembers(nextMembers.slice(0, 4));
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load workspace overview.')).finally(() => setLoading(false));
  }, [currentWorkspace]);

  if (workspaceLoading || loading) return <section className="overview-page"><div className="overview-skeleton" aria-label="Loading overview"><i /><i /><i /><i /></div></section>;
  if (workspaceError || error) return <section className="overview-page"><div className="dashboard-error" role="alert"><span>{workspaceError || error}</span><button type="button" onClick={() => void reload()}>Try again</button></div></section>;
  if (!analytics || !currentWorkspace) return <section className="overview-page"><div className="empty-state"><div className="empty-state-icon">✦</div><p className="eyebrow">Workspace overview</p><h2>Your workspace is ready to set up.</h2><p className="empty-state-description">Choose a workspace to see its health, activity, and next best actions.</p></div></section>;

  const { kpis } = analytics;
  const healthReady = kpis.activeAgents > 0 && kpis.activeDocuments > 0;
  const healthPercent = healthReady ? 100 : kpis.activeAgents > 0 || kpis.activeDocuments > 0 ? 65 : 25;
  return <section className="overview-page">
    <div className="overview-welcome"><div><p className="eyebrow">Good morning <span className="eyebrow-dot" /></p><h2>Here’s what’s happening today.</h2><p>Keep {currentWorkspace.name} healthy, helpful, and ready for every customer.</p></div><Link className="button button-small" href="/dashboard/knowledge/ask">Ask ResolveAI <span>↗</span></Link></div>
    <div className="overview-health-grid"><article className="health-card health-card-primary"><div><span className="health-icon">✦</span><p className="eyebrow">Workspace health</p></div><strong>{healthReady ? 'Healthy' : 'Needs attention'}</strong><small>{healthReady ? 'Agents and knowledge are ready' : 'Add an active agent and ready knowledge document'}</small><div className="health-meter"><i style={{ width: `${healthPercent}%` }} /></div></article><article className="health-card"><div><span className="health-icon violet">◈</span><p className="eyebrow">AI health</p></div><strong>{kpis.activeAgents} active agents</strong><small>{kpis.activeDocuments} ready knowledge documents</small><Link className="text-link" href="/dashboard/ai-agent">Manage agents <span>→</span></Link></article><article className="health-card"><div><span className="health-icon amber">◌</span><p className="eyebrow">Support pulse</p></div><strong>{kpis.totalConversations.toLocaleString()} conversations</strong><small>{kpis.humanHandoffs} human handoffs in the last 30 days</small><Link className="text-link" href="/dashboard/inbox">Open inbox <span>→</span></Link></article></div>
    <div className="overview-columns"><article className="overview-panel"><div className="section-heading"><div><p className="eyebrow">Recent conversations</p><h3>Keep the team moving</h3></div><Link className="text-link" href="/dashboard/conversations">View all <span>→</span></Link></div>{conversations.length ? <div className="overview-list">{conversations.map((item) => <Link className="overview-list-row" href={`/dashboard/conversations/${item.id}`} key={item.id}><span className="list-icon">◌</span><span><strong>{item.title || 'Untitled conversation'}</strong><small>{item.status.toLowerCase()} · {formatDate(item.lastMessageAt)}</small></span><span className="row-arrow">→</span></Link>)}</div> : <div className="mini-empty"><span>◌</span><p>No conversations yet.</p><Link href="/dashboard/knowledge/ask">Start a conversation</Link></div>}</article><article className="overview-panel"><div className="section-heading"><div><p className="eyebrow">Knowledge</p><h3>Recent uploads</h3></div><Link className="text-link" href="/dashboard/knowledge">Open library <span>→</span></Link></div>{documents.length ? <div className="overview-list">{documents.map((item) => <Link className="overview-list-row" href={`/dashboard/knowledge/${item.id}`} key={item.id}><span className="list-icon file">▤</span><span><strong>{item.name}</strong><small>{item.status.toLowerCase()} · updated {formatDate(item.createdAt)}</small></span><span className={`status-dot status-dot-${item.status.toLowerCase()}`} /></Link>)}</div> : <div className="mini-empty"><span>▤</span><p>No documents uploaded.</p><Link href="/dashboard/knowledge">Upload your first document</Link></div>}</article></div>
    <div className="overview-columns overview-bottom"><article className="overview-panel"><div className="section-heading"><div><p className="eyebrow">Team activity</p><h3>People with access</h3></div><Link className="text-link" href="/dashboard/team">Manage team <span>→</span></Link></div><div className="avatar-stack">{members.map((member) => <span className="user-avatar" title={member.user.email} key={member.user.id}>{member.user.firstName[0]}{member.user.lastName[0]}</span>)}<span className="avatar-count">{members.length || 0} members</span></div><p className="overview-muted">Invite teammates to share inbox, knowledge, and agent work.</p></article><article className="overview-panel quick-actions"><div className="section-heading"><div><p className="eyebrow">Quick actions</p><h3>Make progress faster</h3></div></div><div className="quick-action-grid"><Link href="/dashboard/knowledge"><span>▤</span><strong>Upload knowledge</strong></Link><Link href="/dashboard/ai-agent/new"><span>✦</span><strong>Create agent</strong></Link><Link href="/dashboard/widget"><span>◇</span><strong>Configure widget</strong></Link><Link href="/dashboard/team"><span>＋</span><strong>Invite teammate</strong></Link></div></article></div>
  </section>;
}
