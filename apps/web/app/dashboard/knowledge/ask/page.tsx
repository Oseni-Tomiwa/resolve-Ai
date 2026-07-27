'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useDashboard } from '../../dashboard-context';

type AnswerSource = { number: number; documentId: string; documentName: string; chunkIndex: number; contentPreview: string; similarityScore: number };
type AnswerResponse = { answer: string; sources: AnswerSource[] };
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function ask(workspaceId: string, question: string): Promise<AnswerResponse> {
  const response = await fetch(`${apiBaseUrl}/workspaces/${workspaceId}/knowledge/answer`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  const body = await response.json() as { success: boolean; message?: string; data?: AnswerResponse };
  if (!response.ok || !body.success || !body.data) throw new Error(body.message ?? 'Unable to generate a grounded answer.');
  return body.data;
}

export default function AskKnowledge() {
  const { currentWorkspace, loading: workspaceLoading, error: workspaceError, reload } = useDashboard();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AnswerResponse | null>(null);
  const [error, setError] = useState('');
  const [asking, setAsking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!currentWorkspace || asking || !question.trim()) return;
    setAsking(true);
    setError('');
    setAnswer(null);
    try {
      setAnswer(await ask(currentWorkspace.id, question.trim()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate a grounded answer.');
    } finally {
      setAsking(false);
    }
  }

  return <section className="knowledge-page">
    <div className="knowledge-intro"><div><p className="eyebrow">Workspace knowledge</p><h2>Ask ResolveAI.</h2><p>Get answers grounded in the documents your team has added to this workspace.</p></div><Link className="button button-small" href="/dashboard/knowledge">Knowledge base <span>↗</span></Link></div>
    {workspaceLoading && <p className="dashboard-inline-status" role="status">Loading your workspace…</p>}
    {workspaceError && <div className="dashboard-error" role="alert"><span>{workspaceError}</span><button type="button" onClick={() => void reload()}>Try again</button></div>}
    {!workspaceLoading && currentWorkspace && <form className="knowledge-answer-panel" onSubmit={(event) => void submit(event)}><div><p className="eyebrow">Grounded answers</p><h3>What would you like to know?</h3><p>Answers use only ready source material from {currentWorkspace.name} and include citations.</p></div><div className="knowledge-search-controls"><label htmlFor="knowledge-question">Your question</label><div className="knowledge-search-row"><input id="knowledge-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="How can a customer request a refund?" maxLength={1000} /><button className="button button-small" type="submit" disabled={asking || !question.trim()}>{asking ? 'Thinking…' : 'Ask ResolveAI'}</button></div></div></form>}
    {error && <div className="dashboard-error" role="alert">{error}</div>}
    {answer && <section className="knowledge-answer-results" aria-live="polite"><div className="section-heading"><div><p className="eyebrow">Grounded answer</p><h3>Based on workspace knowledge</h3></div><span className="section-hint">{currentWorkspace?.name}</span></div><p className="knowledge-answer-disclaimer">This answer is based only on retrieved source passages. Verify important decisions against the original documents.</p><div className="knowledge-answer-copy">{answer.answer.split(/(\[\d+\])/g).map((part, index) => { const number = Number(part.match(/^\[(\d+)\]$/)?.[1] ?? 0); const source = answer.sources.find((candidate) => candidate.number === number); return source ? <Link key={`${part}-${index}`} href={`/dashboard/knowledge/${source.documentId}`} className="knowledge-citation">{part}</Link> : <span key={`${part}-${index}`}>{part}</span>; })}</div>{answer.sources.length > 0 && <div className="knowledge-answer-sources"><p className="eyebrow">Sources used</p>{answer.sources.map((source) => <Link className="knowledge-answer-source" href={`/dashboard/knowledge/${source.documentId}`} key={source.number}><span><strong>[{source.number}] {source.documentName}</strong><small>Chunk {source.chunkIndex + 1} · {source.contentPreview}</small></span><b>{Math.round(source.similarityScore * 100)}%</b></Link>)}</div>}</section>}
  </section>;
}
