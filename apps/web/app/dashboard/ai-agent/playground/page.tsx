'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useDashboard } from '../../dashboard-context';
import { apiFetch, apiRequest } from '../../../api-client';

type Status = 'DRAFT' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
type Agent = { id: string; name: string; description: string | null; model: string; status: Status; isDefault: boolean; selectedDocumentCount: number };
type AgentPage = { items: Agent[] };
type Source = { id: string; number: number; documentId: string; documentName: string; chunkIndex: number; contentPreview: string; similarityScore: number; cited: boolean };
type PlaygroundResult = { answer: string; sources: Source[]; metadata: { model: string | null; provider?: string; retrievalResultCount: number; latencyMs: number; insufficientContext: boolean; usage?: { inputTokens: number; outputTokens: number } } };
type Message = { id: string; role: 'USER' | 'ASSISTANT'; content: string; sources: Source[]; status?: string };
type StreamEvent = { type: string; delta?: string; sources?: Source[]; message?: { id: string; content: string; status: string; sources: Source[] }; error?: { message?: string } };

const suggestedQuestions = ['How do I reset my password?', 'What is our refund policy?', 'How can I contact support?'];
const messageId = (): string => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `message-${Date.now()}`;

function renderMarkdown(value: string): ReactNode {
  return value.split('```').map((block, index) => index % 2 === 1 ? <pre className="playground-code" key={`code-${index}`}><code>{block.replace(/^\w+\n/, '')}</code></pre> : <div className="playground-markdown" key={`text-${index}`}>{block.split('\n').map((line, lineIndex) => line.trim() ? <p key={`${index}-${lineIndex}`}>{line}</p> : null)}</div>);
}

export default function AgentPlaygroundPage() {
  const { currentWorkspace, loading: workspaceLoading, error: workspaceError, reload } = useDashboard();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [metadata, setMetadata] = useState<PlaygroundResult['metadata'] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQuestionRef = useRef('');

  const load = useCallback(async () => {
    if (!currentWorkspace) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const data = await apiRequest<AgentPage>(`/workspaces/${currentWorkspace.id}/ai/agents?page=1&pageSize=50`);
      setAgents(data.items);
      setSelectedId((current) => current || data.items.find((agent) => agent.isDefault)?.id || data.items[0]?.id || '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load agents.'); }
    finally { setLoading(false); }
  }, [currentWorkspace]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setMessages([]); setMetadata(null); setNotice(''); }, [selectedId]);

  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === selectedId) ?? null, [agents, selectedId]);

  async function submit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    if (!currentWorkspace || !selectedAgent || !question.trim() || generating) return;
    const content = question.trim(); setQuestion(''); lastQuestionRef.current = content; setError(''); setNotice(''); setMetadata(null); setGenerating(true);
    const userMessage: Message = { id: messageId(), role: 'USER', content, sources: [] };
    setMessages((current) => [...current, userMessage]);
    const controller = new AbortController(); abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    try {
      if (selectedAgent.status === 'DRAFT') {
        const result = await apiRequest<PlaygroundResult>(`/workspaces/${currentWorkspace.id}/ai/agents/${selectedAgent.id}/playground`, { method: 'POST', body: JSON.stringify({ question: content }), signal: controller.signal });
        setMessages((current) => [...current, { id: messageId(), role: 'ASSISTANT', content: result.answer, sources: result.sources, status: result.metadata.insufficientContext ? 'INSUFFICIENT_CONTEXT' : 'COMPLETE' }]);
        setMetadata(result.metadata); setNotice('Draft test completed. This response was not saved as a customer conversation.');
      } else {
        const conversationResponse = await apiRequest<{ id: string }>(`/workspaces/${currentWorkspace.id}/ai/conversations`, { method: 'POST', body: JSON.stringify({ agentId: selectedAgent.id }) });
        const response = await apiFetch(`/workspaces/${currentWorkspace.id}/ai/conversations/${conversationResponse.id}/messages/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: JSON.stringify({ content }), signal: controller.signal });
        if (!response.ok || !response.body) throw new Error('Unable to start the agent response.');
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let assistantId = '';
        const appendAssistant = (delta: string): void => setMessages((current) => { const existing = current.find((message) => message.id === assistantId); if (!existing) return [...current, { id: assistantId, role: 'ASSISTANT', content: delta, sources: [] }]; return current.map((message) => message.id === assistantId ? { ...message, content: message.content + delta } : message); });
        const handle = (event: StreamEvent): void => { if (event.type === 'message.started') { assistantId = messageId(); setMessages((current) => [...current, { id: assistantId, role: 'ASSISTANT', content: '', sources: [], status: 'STREAMING' }]); } if (event.type === 'message.delta' && event.delta) appendAssistant(event.delta); if (event.type === 'sources') setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, sources: event.sources ?? [] } : message)); if (event.type === 'message.completed' && event.message) setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: event.message?.content ?? message.content, sources: event.message?.sources ?? message.sources, status: 'COMPLETE' } : message)); if (event.type === 'message.failed') throw new Error(event.error?.message ?? 'The agent could not complete this response.'); };
        while (true) { const chunk = await reader.read(); if (chunk.done) break; buffer += decoder.decode(chunk.value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() ?? ''; for (const line of lines) if (line.trim()) handle(JSON.parse(line) as StreamEvent); }
        if (buffer.trim()) handle(JSON.parse(buffer) as StreamEvent);
        setNotice('Published agent response completed. This test is saved in Conversations.');
      }
    } catch (cause) { if (cause instanceof Error && cause.name === 'AbortError') setNotice('Generation stopped.'); else setError(cause instanceof Error ? cause.message : 'The agent could not complete this response.'); }
    finally { window.clearTimeout(timeout); abortRef.current = null; setGenerating(false); }
  }

  function stop(): void { abortRef.current?.abort(); }
  function retry(): void { if (lastQuestionRef.current) { setQuestion(lastQuestionRef.current); setNotice(''); } }
  function clear(): void { if (generating) return; setMessages([]); setMetadata(null); setError(''); setNotice(''); }

  if (workspaceLoading || loading) return <section className="agent-page"><p className="dashboard-inline-status" role="status">Loading Playground…</p></section>;
  if (workspaceError) return <section className="agent-page"><div className="dashboard-error" role="alert"><span>{workspaceError}</span><button type="button" onClick={() => void reload()}>Try again</button></div></section>;
  if (error && !selectedAgent) return <section className="agent-page"><div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div></section>;

  return <section className="agent-page agent-playground-page">
    <div className="agent-management-hero"><div><Link className="text-link" href="/dashboard/ai-agent">← All agents</Link><p className="eyebrow">Workspace AI</p><h2>Agent Playground</h2><p>Test an agent with workspace knowledge before you put it in front of customers.</p></div><Link className="button button-ghost button-small" href={selectedAgent ? `/dashboard/ai-agent/${selectedAgent.id}` : '/dashboard/ai-agent'}>Edit agent <span>↗</span></Link></div>
    {error && <div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={retry}>Retry</button></div>}
    {agents.length === 0 ? <div className="empty-state agent-empty"><div className="empty-state-icon">✦</div><h2>Create an agent to start testing.</h2><Link className="button button-small" href="/dashboard/ai-agent/new">Create agent <span>↗</span></Link></div> : <>
      <div className="playground-toolbar"><label htmlFor="playground-agent">Agent<select id="playground-agent" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.status === 'ACTIVE' ? 'Published' : agent.status}</option>)}</select></label><div className="playground-agent-meta"><span className={`agent-badge ${selectedAgent?.status.toLowerCase()}`}>{selectedAgent?.status === 'ACTIVE' ? 'Published' : selectedAgent?.status}</span><span>{selectedAgent?.model}</span><span>{selectedAgent?.selectedDocumentCount ?? 0} selected documents</span></div><button className="text-action" type="button" onClick={clear} disabled={generating || messages.length === 0}>Clear</button></div>
      <div className="playground-surface"><div className="playground-thread" aria-live="polite">{messages.length === 0 ? <div className="knowledge-empty"><div className="empty-state-icon">✦</div><h3>Ask this agent a question.</h3><p>{selectedAgent?.status === 'DRAFT' ? 'Draft responses use the selected knowledge without creating a customer conversation.' : 'Published responses use the real conversation stream and are saved in Conversations.'}</p><div className="playground-suggestions">{suggestedQuestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}</div></div> : messages.map((message) => <article className={`playground-message ${message.role.toLowerCase()}`} key={message.id}><span className="message-label">{message.role === 'USER' ? 'You' : selectedAgent?.name || 'ResolveAI'}</span>{message.role === 'ASSISTANT' ? renderMarkdown(message.content || (generating ? 'Thinking…' : 'No response returned.')) : <p>{message.content}</p>}{message.sources.length > 0 && <div className="message-sources"><p className="eyebrow">Sources</p>{message.sources.map((source) => <Link href={`/dashboard/knowledge/${source.documentId}`} key={source.id}><strong>[{source.number}] {source.documentName}</strong><small>Chunk {source.chunkIndex + 1} · {source.contentPreview}</small></Link>)}</div>}</article>)}</div></div>
      {metadata && <div className="playground-metadata"><span>Retrieved {metadata.retrievalResultCount} passages</span><span>{metadata.latencyMs}ms</span>{metadata.usage && <span>{metadata.usage.inputTokens + metadata.usage.outputTokens} tokens</span>}{metadata.insufficientContext && <strong>Insufficient context</strong>}</div>}
      {notice && <p className="team-success" role="status">{notice}</p>}
      <form className="playground-composer" onSubmit={(event) => void submit(event)}><label htmlFor="playground-question">Ask a follow-up</label><textarea id="playground-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} placeholder="Ask about your workspace knowledge…" disabled={generating} /><div><small>Enter to send · Shift+Enter for a new line</small>{generating ? <button className="button button-small" type="button" onClick={stop}>Stop</button> : <><button className="text-action" type="button" onClick={retry} disabled={!lastQuestionRef.current}>Retry</button><button className="button button-small" type="submit" disabled={!question.trim()}>Send <span>↗</span></button></>}</div></form>
    </>}
  </section>;
}
