(() => {
  type WidgetWindow = Window & { __resolveaiWidgets?: Record<string, boolean> };
  type Config = { publicId: string; enabled: boolean; name: string; greeting: string; accentColor: string; position: string; launcherLabel: string; agent: { name: string; description: string | null; greeting: string | null } };
  type Source = { number: number; documentName: string; contentPreview: string; cited: boolean };
  type Message = { id?: string; role: 'USER' | 'ASSISTANT' | 'HUMAN' | 'SYSTEM'; content: string; sources?: Source[] };
  type MessageResponse = { status: 'OPEN' | 'PENDING' | 'RESOLVED'; mode: 'AI' | 'HUMAN'; messages: Message[] };
  type Envelope<T> = { success: boolean; message?: string; data: T; code?: string };

  const current = document.currentScript as HTMLScriptElement | null;
  const script = current?.dataset.resolveaiWidgetId
    ? current
    : Array.from(document.scripts).find((candidate) => candidate.src.includes('/widget.js') && candidate.dataset.resolveaiWidgetId) ?? null;
  const widgetId = script?.dataset.resolveaiWidgetId?.trim();
  if (!widgetId) return;

  const registry = (window as WidgetWindow).__resolveaiWidgets ??= {};
  if (registry[widgetId] || script?.dataset.resolveaiInitialized === 'true') return;
  registry[widgetId] = true;
  if (script) script.dataset.resolveaiInitialized = 'true';

  const apiBase = (script?.dataset.resolveaiApi ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
  const storageKey = `resolveai.widget.${widgetId}`;
  let config: Config | null = null;
  let sessionId = '';
  let conversationId = '';
  let messages: Message[] = [];
  let currentMode: 'AI' | 'HUMAN' = 'AI';
  let currentStatus: MessageResponse['status'] = 'OPEN';
  let open = false;
  let busy = false;
  let pollTimer: number | undefined;

  const root = document.createElement('div');
  const shadow = root.attachShadow({ mode: 'open' });
  (document.body ?? document.documentElement).appendChild(root);
  const style = document.createElement('style');
  style.textContent = `:host{all:initial}*{box-sizing:border-box}.wrap{position:fixed;z-index:2147483000;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#eaf0f8}.wrap.right{right:20px}.wrap.left{left:20px}.launcher{display:flex;align-items:center;gap:9px;border:0;border-radius:999px;padding:13px 17px;color:#07121b;background:var(--accent);box-shadow:0 12px 32px #0005;font:600 13px inherit;cursor:pointer}.launcher:focus-visible,.send:focus-visible,.close:focus-visible,.handoff:focus-visible,textarea:focus-visible{outline:3px solid #fff;outline-offset:3px}.bubble{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;color:#07121b;background:#fff5;font-size:18px}.panel{display:flex;flex-direction:column;width:min(380px,calc(100vw - 32px));height:min(590px,calc(100vh - 100px));margin-bottom:12px;overflow:hidden;border:1px solid #ffffff24;border-radius:20px;background:#0b1220;box-shadow:0 24px 70px #0008}.hidden{display:none}.head{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 15px;background:linear-gradient(135deg,var(--accent)33,#151f33)}.head strong{display:block;font-size:15px}.head small{display:block;margin-top:4px;color:#bdc8d7;font-size:11px}.close{border:0;color:#dce7f1;background:transparent;font-size:22px;cursor:pointer}.messages{flex:1;display:grid;align-content:start;gap:10px;padding:16px;overflow:auto}.msg{max-width:86%;padding:11px 12px;border-radius:14px;color:#e9f0f7;background:#172338;font-size:13px;line-height:1.55;white-space:pre-wrap}.msg.user{justify-self:end;color:#07121b;background:var(--accent)}.sources{display:grid;gap:5px;margin-top:9px;color:#a8b6c8;font-size:10px}.sources b{color:var(--accent)}.composer{display:flex;gap:8px;padding:12px;border-top:1px solid #ffffff18}.composer textarea{flex:1;min-height:43px;max-height:100px;resize:none;border:1px solid #ffffff20;border-radius:11px;padding:11px;color:#e9f0f7;background:#111c2e;font:13px inherit}.send{width:43px;border:0;border-radius:11px;color:#07121b;background:var(--accent);font-size:18px;cursor:pointer}.handoff{border:1px solid #ffffff24;border-radius:11px;padding:0 9px;color:#dce7f1;background:#172338;font-size:11px;cursor:pointer}.error{padding:8px 16px;color:#ffb7c4;background:#6f183524;font-size:11px}@media(max-width:600px){.wrap.right,.wrap.left{right:10px;left:10px}.panel{width:calc(100vw - 20px);height:calc(100vh - 90px)}.launcher{margin-left:auto}.handoff{padding:0 6px;font-size:10px}}`;
  shadow.appendChild(style);

  const wrap = document.createElement('div'); wrap.className = 'wrap right';
  const panel = document.createElement('section'); panel.className = 'panel hidden'; panel.setAttribute('aria-label', 'ResolveAI support chat'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
  const head = document.createElement('header'); head.className = 'head';
  const title = document.createElement('div');
  const close = document.createElement('button'); close.className = 'close'; close.type = 'button'; close.setAttribute('aria-label', 'Close support chat'); close.textContent = '×';
  const list = document.createElement('div'); list.className = 'messages';
  const error = document.createElement('div'); error.className = 'error'; error.hidden = true;
  const composer = document.createElement('form'); composer.className = 'composer';
  const input = document.createElement('textarea'); input.maxLength = 4000; input.placeholder = 'Ask a question…'; input.setAttribute('aria-label', 'Message');
  const handoff = document.createElement('button'); handoff.className = 'handoff'; handoff.type = 'button'; handoff.textContent = 'Talk to a human';
  const send = document.createElement('button'); send.className = 'send'; send.type = 'submit'; send.setAttribute('aria-label', 'Send message'); send.textContent = '↑';
  composer.append(input, handoff, send);
  panel.append(head, list, error, composer);
  const launcher = document.createElement('button'); launcher.className = 'launcher'; launcher.type = 'button'; launcher.setAttribute('aria-expanded', 'false'); launcher.setAttribute('aria-label', 'Open ResolveAI support chat');
  const bubble = document.createElement('span'); bubble.className = 'bubble'; bubble.textContent = '✦';
  const launcherText = document.createElement('span'); launcherText.textContent = 'Chat'; launcher.append(bubble, launcherText);
  wrap.append(panel, launcher); shadow.appendChild(wrap);

  const setError = (message = '') => { error.textContent = message; error.hidden = !message; };
  const publicError = (code: string): string => ({ WIDGET_DISABLED: 'This support chat is currently unavailable.', WIDGET_ORIGIN_NOT_ALLOWED: 'This support chat is not available on this website.', WIDGET_SESSION_INVALID: 'Your support session is no longer valid. Refresh to try again.', WIDGET_SESSION_EXPIRED: 'Your support session expired. Refresh to try again.', RATE_LIMITED: 'Please wait a moment before trying again.', AGENT_UNAVAILABLE: 'The support assistant is currently unavailable.', AI_PROVIDER_UNAVAILABLE: 'The support assistant is temporarily unavailable.' }[code] ?? 'The support chat is unavailable.');
  const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${apiBase}${path}`, { ...init, headers: { 'Content-Type': 'application/json', 'X-Request-Id': globalThis.crypto?.randomUUID?.() ?? `widget-${Date.now()}`, ...init?.headers } });
    let body: Envelope<T>;
    try { body = await response.json() as Envelope<T>; } catch { throw new Error(publicError('INTERNAL_ERROR')); }
    if (!response.ok || !body.success) { const failure = new Error(publicError(body.code ?? 'INTERNAL_ERROR')) as Error & { code?: string }; failure.code = body.code; throw failure; }
    return body.data;
  };
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify({ sessionId, conversationId })); } catch { /* Host privacy settings may disable storage. */ } };
  const loadSaved = (): { sessionId?: string; conversationId?: string } => { try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as { sessionId?: string; conversationId?: string }; } catch { return {}; } };
  const render = () => { list.replaceChildren(...messages.map((message) => { const item = document.createElement('article'); item.className = `msg ${message.role === 'USER' ? 'user' : ''}`; item.textContent = message.role === 'HUMAN' ? `Support teammate: ${message.content}` : message.content; if (message.sources?.length) { const sources = document.createElement('div'); sources.className = 'sources'; message.sources.forEach((source) => { const row = document.createElement('div'); const citation = document.createElement('b'); citation.textContent = `[${source.number}]`; row.append(citation, document.createTextNode(` ${source.documentName}`)); sources.appendChild(row); }); item.appendChild(sources); } return item; })); list.scrollTop = list.scrollHeight; };
  const merge = (incoming: Message[]) => { const ephemeral = messages.filter((message) => !message.id); const byId = new Map(messages.filter((message) => message.id && !message.id.startsWith('temp-')).map((message) => [message.id, message])); for (const message of incoming) { if (message.id) byId.set(message.id, message); } messages = [...ephemeral, ...Array.from(byId.values())]; };
  const refreshMessages = async () => { if (!sessionId || !conversationId || document.hidden) return; const response = await request<MessageResponse>(`/public/widgets/${encodeURIComponent(widgetId)}/conversations/${conversationId}/messages?sessionId=${encodeURIComponent(sessionId)}`); currentMode = response.mode; currentStatus = response.status; merge(response.messages); input.disabled = currentStatus === 'RESOLVED'; send.disabled = input.disabled; handoff.disabled = input.disabled || currentMode === 'HUMAN'; render(); };
  const startPolling = () => { if (!pollTimer) pollTimer = window.setInterval(() => { void refreshMessages().catch(() => undefined); }, 2500); };
  const stopPolling = () => { if (pollTimer) { window.clearInterval(pollTimer); pollTimer = undefined; } };
  const toggle = () => { open = !open; panel.classList.toggle('hidden', !open); launcher.setAttribute('aria-expanded', String(open)); if (open) { input.focus(); startPolling(); } else { stopPolling(); launcher.focus(); } };

  const initialize = async () => {
    window.dispatchEvent(new CustomEvent('resolveai-widget-status', { detail: { publicId: widgetId, apiBase, status: 'loading' } }));
    try {
      config = await request<Config>(`/public/widgets/${encodeURIComponent(widgetId)}/config`);
      window.dispatchEvent(new CustomEvent('resolveai-widget-status', { detail: { publicId: widgetId, apiBase, status: 'config-loaded', enabled: config.enabled, origin: 'accepted' } }));
      if (!config.enabled) { launcher.remove(); throw new Error(publicError('WIDGET_DISABLED')); }
      wrap.style.setProperty('--accent', config.accentColor); wrap.className = `wrap ${config.position === 'BOTTOM_LEFT' ? 'left' : 'right'}`;
      const titleStrong = document.createElement('strong'); titleStrong.textContent = config.name; const agentName = document.createElement('small'); agentName.textContent = config.agent.name; title.append(titleStrong, agentName); head.append(title, close); launcherText.textContent = config.launcherLabel;
      const saved = loadSaved(); const session = await request<{ sessionId: string }>(`/public/widgets/${encodeURIComponent(widgetId)}/sessions`, { method: 'POST', body: JSON.stringify({ sessionId: saved.sessionId }) }); sessionId = session.sessionId;
      if (saved.conversationId) { conversationId = saved.conversationId; const response = await request<MessageResponse>(`/public/widgets/${encodeURIComponent(widgetId)}/conversations/${conversationId}/messages?sessionId=${encodeURIComponent(sessionId)}`); messages = response.messages; currentMode = response.mode; currentStatus = response.status; input.disabled = currentStatus === 'RESOLVED'; send.disabled = input.disabled; handoff.disabled = input.disabled || currentMode === 'HUMAN'; } else { const conversation = await request<{ id: string; greeting: string }>(`/public/widgets/${encodeURIComponent(widgetId)}/conversations`, { method: 'POST', body: JSON.stringify({ sessionId, title: 'Visitor support conversation' }) }); conversationId = conversation.id; messages = [{ role: 'ASSISTANT', content: conversation.greeting }]; }
      save(); render(); window.dispatchEvent(new CustomEvent('resolveai-widget-ready', { detail: { publicId: widgetId, apiBase, enabled: config.enabled } }));
    } catch (caught) { const failure = caught as Error & { code?: string }; const message = failure.code ? publicError(failure.code) : caught instanceof Error ? caught.message : publicError('INTERNAL_ERROR'); setError(message); window.dispatchEvent(new CustomEvent('resolveai-widget-error', { detail: { publicId: widgetId, apiBase, message, code: failure.code ?? 'INTERNAL_ERROR' } })); }
  };

  launcher.addEventListener('click', toggle); close.addEventListener('click', toggle);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && open) toggle(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPolling(); else if (open) { void refreshMessages(); startPolling(); } });
  handoff.addEventListener('click', async () => { if (!conversationId || !sessionId || busy) return; busy = true; handoff.disabled = true; setError(); try { await request(`/public/widgets/${encodeURIComponent(widgetId)}/conversations/${conversationId}/request-human`, { method: 'POST', body: JSON.stringify({ sessionId }) }); await refreshMessages(); } catch (caught) { setError(caught instanceof Error ? caught.message : publicError('INTERNAL_ERROR')); handoff.disabled = false; } finally { busy = false; } });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); composer.requestSubmit(); } });
  composer.addEventListener('submit', async (event) => { event.preventDefault(); const content = input.value.trim(); if (!content || busy || !conversationId) return; busy = true; input.disabled = true; send.disabled = true; handoff.disabled = true; setError(); input.value = ''; const clientMessageId = `widget-${Date.now()}-${Math.random().toString(36).slice(2)}`; messages.push({ id: `temp-${clientMessageId}`, role: 'USER', content }, { id: `temp-${clientMessageId}-assistant`, role: 'ASSISTANT', content: '' }); render(); const assistant = messages[messages.length - 1]!; const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 45000); try { const response = await fetch(`${apiBase}/public/widgets/${encodeURIComponent(widgetId)}/conversations/${conversationId}/messages/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': globalThis.crypto?.randomUUID?.() ?? `widget-${Date.now()}` }, body: JSON.stringify({ sessionId, content, clientMessageId }), signal: controller.signal }); if (!response.ok || !response.body) throw new Error(publicError('AI_PROVIDER_UNAVAILABLE')); const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; for (;;) { const chunk = await reader.read(); if (chunk.done) break; buffer += decoder.decode(chunk.value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() ?? ''; for (const line of lines) { if (!line) continue; const streamEvent = JSON.parse(line) as { type: string; mode?: string; delta?: string; sources?: Source[]; error?: { code?: string; message: string } }; if (streamEvent.type === 'message.delta') assistant.content += streamEvent.delta ?? ''; if (streamEvent.type === 'sources') assistant.sources = streamEvent.sources; if (streamEvent.type === 'message.completed' && streamEvent.mode === 'HUMAN') { currentMode = 'HUMAN'; messages.pop(); } if (streamEvent.type === 'message.failed') throw new Error(publicError(streamEvent.error?.code ?? 'AI_PROVIDER_UNAVAILABLE')); render(); } } await refreshMessages(); } catch (caught) { assistant.content = ''; setError(caught instanceof Error && caught.name !== 'AbortError' ? caught.message : publicError('AI_PROVIDER_UNAVAILABLE')); render(); } finally { window.clearTimeout(timeout); busy = false; input.disabled = currentStatus === 'RESOLVED'; send.disabled = input.disabled; handoff.disabled = input.disabled || currentMode === 'HUMAN'; input.focus(); } });
  void initialize().then(() => { if (script?.dataset.resolveaiOpen === 'true' && config?.enabled) toggle(); const demoQuestion = script?.dataset.resolveaiQuestion?.trim(); if (demoQuestion && config?.enabled) { input.value = demoQuestion; composer.requestSubmit(); } });
})();
