'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useDashboard } from '../../dashboard-context';
import { apiRequest } from '../../../api-client';

type Agent = { id: string; name: string; description: string | null; status: string; isDefault: boolean; selectedDocumentCount: number };
type Document = { id: string; name: string; originalFileName: string; updatedAt: string };
type Source = { number?: number; documentId: string; documentName: string; chunkIndex: number; contentPreview: string; similarityScore: number };
type Result = { answer: string; sources: Source[]; metadata?: { model?: string | null; provider?: string | null; retrievalResultCount?: number; insufficientContext?: boolean } };
type Test = { question: string; answer: string; createdAt: string };

export default function AskKnowledge() {
  const { currentWorkspace, loading: workspaceLoading, error: workspaceError, reload } = useDashboard();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [agentId, setAgentId] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Result | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) return;
    let cancelled = false;
    setLoading(true); setError('');
    void Promise.all([
      apiRequest<{ items: Agent[] }>(`/workspaces/${currentWorkspace.id}/ai/agents?page=1&pageSize=50`),
      apiRequest<Document[]>(`/workspaces/${currentWorkspace.id}/ai/agents/knowledge-documents`),
    ]).then(([agentResult, documentResult]) => {
      if (cancelled) return;
      setAgents(agentResult.items); setDocuments(documentResult);
      setAgentId((current) => current || agentResult.items.find((agent) => agent.isDefault)?.id || agentResult.items[0]?.id || '');
      try { setTests(JSON.parse(window.localStorage.getItem(`resolveai.ask-tests.${currentWorkspace.id}`) ?? '[]') as Test[]); } catch { setTests([]); }
    }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load agents and documents.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentWorkspace]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!currentWorkspace || !agentId || asking || !question.trim()) return;
    setAsking(true); setError(''); setAnswer(null);
    try {
      const result = await apiRequest<Result>(`/workspaces/${currentWorkspace.id}/ai/agents/${agentId}/playground`, { method: 'POST', body: JSON.stringify({ question: question.trim() }) });
      setAnswer(result);
      const next = [{ question: question.trim(), answer: result.answer, createdAt: new Date().toISOString() }, ...tests].slice(0, 5);
      setTests(next); window.localStorage.setItem(`resolveai.ask-tests.${currentWorkspace.id}`, JSON.stringify(next));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to generate a grounded answer.'); }
    finally { setAsking(false); }
  }

  return <section className="knowledge-page">
    <div className="knowledge-intro"><div><p className="eyebrow">Workspace knowledge</p><h2>Ask ResolveAI.</h2><p>Test a saved agent against the READY documents connected to this workspace.</p></div><Link className="button button-small" href="/dashboard/knowledge">Knowledge base <span>↗</span></Link></div>
    {workspaceLoading && <p className="dashboard-inline-status" role="status">Loading your workspace…</p>}
    {workspaceError && <div className="dashboard-error" role="alert"><span>{workspaceError}</span><button type="button" onClick={() => void reload()}>Try again</button></div>}
    {!workspaceLoading && currentWorkspace && <>
      {loading ? <p className="dashboard-inline-status">Loading agents and source documents…</p> : <form className="knowledge-answer-panel" onSubmit={(event) => void submit(event)}><div><p className="eyebrow">Grounded answers</p><h3>What would you like to know?</h3><p>Only the selected agent’s published behavior and workspace-scoped source material are used.</p></div><div className="knowledge-search-controls"><label htmlFor="ask-agent">Agent<select id="ask-agent" value={agentId} onChange={(event) => setAgentId(event.target.value)} disabled={agents.length === 0}>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}{agent.isDefault ? ' · Default' : ''}</option>)}</select></label><label htmlFor="knowledge-question">Your question</label><div className="knowledge-search-row"><input id="knowledge-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="How can a customer request a refund?" maxLength={1000} /><button className="button button-small" type="submit" disabled={asking || !agentId || !question.trim()}>{asking ? 'Thinking…' : 'Ask ResolveAI'}</button></div><small>{documents.length} READY document{documents.length === 1 ? '' : 's'} available to agents.</small></div></form>}
      {documents.length === 0 && !loading && <div className="knowledge-empty"><h3>Add a READY document before testing.</h3><p>Upload a handbook, FAQ, or policy in the Knowledge Base.</p><Link className="button button-small" href="/dashboard/knowledge">Open Knowledge Base</Link></div>}
    </>}
    {error && <div className="dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={() => window.location.reload()}>Try again</button></div>}
    {answer && <section className="knowledge-answer-results" aria-live="polite"><div className="section-heading"><div><p className="eyebrow">Grounded answer</p><h3>{answer.metadata?.insufficientContext ? 'Not enough context found' : 'Based on workspace knowledge'}</h3></div><span className="section-hint">{answer.metadata?.model ?? 'Configured agent'}</span></div><p className="knowledge-answer-disclaimer">{answer.metadata?.insufficientContext ? 'The agent did not find enough relevant source material to answer safely.' : 'This answer is based only on retrieved source passages.'}</p><div className="knowledge-answer-copy">{answer.answer}</div>{answer.sources.length > 0 && <div className="knowledge-answer-sources"><p className="eyebrow">Sources used</p>{answer.sources.map((source, index) => <Link className="knowledge-answer-source" href={`/dashboard/knowledge/${source.documentId}`} key={`${source.documentId}-${source.chunkIndex}-${source.number ?? index}`}><span><strong>[{source.number ?? index + 1}] {source.documentName}</strong><small>Chunk {source.chunkIndex + 1} · {source.contentPreview}</small></span><b>{Math.round(source.similarityScore * 100)}%</b></Link>)}</div>}</section>}
    {tests.length > 0 && <section className="knowledge-search-results"><div className="section-heading"><div><p className="eyebrow">Recent local tests</p><h3>Previous questions</h3></div></div>{tests.map((test) => <button className="knowledge-row" type="button" key={test.createdAt} onClick={() => setQuestion(test.question)}><span className="knowledge-name"><strong>{test.question}</strong><small>{test.answer.slice(0, 140)}</small></span><span>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(test.createdAt))}</span></button>)}</section>}
  </section>;
}
