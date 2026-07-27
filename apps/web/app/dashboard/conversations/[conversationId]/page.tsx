'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useParams } from 'next/navigation';
import { useDashboard } from '../../dashboard-context';

type Source = { id: string; number: number; documentId: string; documentName: string; chunkIndex: number; contentPreview: string; similarityScore: number; cited: boolean };
type Message = { id: string; role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string; status: string; errorCode?: string | null; agentName?: string | null; createdAt: string; sources: Source[] };
type Detail = { conversation: { id: string; title: string; workspaceId: string; agent?: { id: string; name: string; description: string | null; greeting: string | null } | null }; messages: Message[]; hasMore: boolean };
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json() as { success: boolean; message?: string; data?: T };
  if (!response.ok || !body.success || body.data === undefined) throw new Error(body.message ?? 'Unable to load this conversation.');
  return body.data;
}

type StreamEvent = { type: string; messageId?: string; delta?: string; sources?: Source[]; message?: Message; error?: { code: string; message: string } };

export default function ConversationDetailPage() {
  const { currentWorkspace, loading: workspaceLoading, error: workspaceError, reload } = useDashboard();
  const params = useParams<{ conversationId: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [streamingSources, setStreamingSources] = useState<Source[]>([]);
  const [error, setError] = useState('');
  const [controller, setController] = useState<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!currentWorkspace || !params.conversationId) return;
    setError('');
    try { setDetail(await api<Detail>(`/workspaces/${currentWorkspace.id}/ai/conversations/${params.conversationId}?page=1&pageSize=100`)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load this conversation.'); }
  }, [currentWorkspace, params.conversationId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [detail?.messages.length, streamingAnswer]);

  async function send(event?: FormEvent<HTMLFormElement>): Promise<void> {
    event?.preventDefault();
    if (!currentWorkspace || !detail || streaming || !draft.trim()) return;
    const content = draft.trim(); setDraft(''); setStreaming(true); setStreamingAnswer(''); setStreamingSources([]); setError('');
    const abort = new AbortController(); setController(abort);
    try {
      const response = await fetch(`${apiBaseUrl}/workspaces/${currentWorkspace.id}/ai/conversations/${detail.conversation.id}/messages/stream`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: JSON.stringify({ content }), signal: abort.signal });
      if (!response.ok || !response.body) throw new Error('Unable to start the grounded response.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break; buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
        for (const line of lines) { if (!line.trim()) continue; let message: StreamEvent; try { message = JSON.parse(line) as StreamEvent; } catch { continue; } if (message.type === 'message.delta' && message.delta) setStreamingAnswer((value) => value + message.delta); if (message.type === 'sources') setStreamingSources(message.sources ?? []); if (message.type === 'message.failed') setError(message.error?.message ?? 'ResolveAI could not complete this response.'); }
      }
      if (buffer.trim()) { try { const message = JSON.parse(buffer) as StreamEvent; if (message.type === 'message.failed') setError(message.error?.message ?? 'ResolveAI could not complete this response.'); } catch { /* Ignore an incomplete network fragment. */ } }
      await load();
    } catch (cause) { if (!(cause instanceof Error && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Unable to send this message.'); } finally { setStreaming(false); setController(null); setStreamingAnswer(''); setStreamingSources([]); }
  }
  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }
  function stop(): void { controller?.abort(); }
  async function retry(message: Message): Promise<void> { const previous = detail?.messages[detail.messages.indexOf(message) - 1]; if (previous?.role === 'USER') { setDraft(previous.content); } }

  if (workspaceLoading) return <section className="conversation-page"><p className="dashboard-inline-status" role="status">Loading your workspace…</p></section>;
  if (workspaceError) return <section className="conversation-page"><div className="dashboard-error" role="alert"><span>{workspaceError}</span><button type="button" onClick={() => void reload()}>Try again</button></div></section>;
  return <section className="conversation-page conversation-detail-page">
    <div className="conversation-detail-heading"><div><Link className="text-link" href="/dashboard/conversations">← All conversations</Link><p className="eyebrow">Grounded workspace conversation</p><h2>{detail?.conversation.title ?? 'Conversation'}</h2>{detail?.conversation.agent && <p className="conversation-agent-label">Using {detail.conversation.agent.name}{detail.conversation.agent.description ? ` · ${detail.conversation.agent.description}` : ''}</p>}{detail?.messages.length === 0 && detail.conversation.agent?.greeting && <p className="conversation-agent-greeting">{detail.conversation.agent.greeting}</p>}</div><Link className="button button-small" href="/dashboard/knowledge/ask">Ask a quick question <span>↗</span></Link></div>
    {error && <div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div>}
    {!detail && !error && <p className="dashboard-inline-status" role="status">Loading conversation history…</p>}
    {detail && <><div className="message-thread" aria-live="polite">{detail.messages.map((message) => <article className={`conversation-message ${message.role.toLowerCase()}`} key={message.id}><div className="message-label">{message.role === 'USER' ? 'You' : 'ResolveAI'}</div><div className="message-content">{message.content || (message.status === 'FAILED' ? 'This response could not be completed.' : 'Response unavailable.')}</div>{message.status === 'FAILED' && <button className="message-retry" type="button" onClick={() => void retry(message)}>Retry</button>}{message.sources.length > 0 && <div className="message-sources"><p className="eyebrow">Sources</p>{message.sources.map((source) => <Link href={`/dashboard/knowledge/${source.documentId}`} key={source.id}><strong>[{source.number}] {source.documentName}</strong><small>Chunk {source.chunkIndex + 1} · {source.contentPreview}</small></Link>)}</div>}</article>)}{streaming && <article className="conversation-message assistant"><div className="message-label">ResolveAI · writing</div><div className="message-content">{streamingAnswer || 'Thinking…'}</div>{streamingSources.length > 0 && <div className="message-sources"><p className="eyebrow">Sources</p>{streamingSources.map((source) => <span key={source.id}>[{source.number}] {source.documentName}</span>)}</div>}</article>}<div ref={endRef} /></div><form className="conversation-composer" onSubmit={(event) => void send(event)}><label htmlFor="conversation-message">Ask a follow-up</label><textarea id="conversation-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} maxLength={4000} placeholder="Ask about your workspace knowledge…" disabled={streaming} /><div><small>{draft.length}/4000 · Enter to send, Shift+Enter for a new line</small>{streaming ? <button className="button button-small" type="button" onClick={stop}>Stop</button> : <button className="button button-small" type="submit" disabled={!draft.trim()}>Send <span>↗</span></button>}</div></form></>}
  </section>;
}
