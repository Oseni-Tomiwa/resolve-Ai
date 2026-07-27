"use strict";
(() => {
    const script = document.currentScript;
    const widgetId = script?.dataset.resolveaiWidgetId;
    if (!widgetId)
        return;
    const apiBase = (script?.dataset.resolveaiApi ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
    const storageKey = `resolveai.widget.${widgetId}`;
    let config = null;
    let sessionId = '';
    let conversationId = '';
    let messages = [];
    let open = false;
    let busy = false;
    const root = document.createElement('div');
    const shadow = root.attachShadow({ mode: 'open' });
    document.body.appendChild(root);
    const style = document.createElement('style');
    style.textContent = `:host{all:initial}*{box-sizing:border-box}.wrap{position:fixed;z-index:2147483000;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#eaf0f8}.wrap.right{right:20px}.wrap.left{left:20px}.launcher{display:flex;align-items:center;gap:9px;border:0;border-radius:999px;padding:13px 17px;color:#07121b;background:var(--accent);box-shadow:0 12px 32px #0005;font:600 13px inherit;cursor:pointer}.launcher:focus-visible,.send:focus-visible,.close:focus-visible,textarea:focus-visible{outline:3px solid #fff;outline-offset:3px}.bubble{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;color:#07121b;background:#fff5;font-size:18px}.panel{display:flex;flex-direction:column;width:min(380px,calc(100vw - 32px));height:min(590px,calc(100vh - 100px));margin-bottom:12px;overflow:hidden;border:1px solid #ffffff24;border-radius:20px;background:#0b1220;box-shadow:0 24px 70px #0008}.hidden{display:none}.head{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 15px;background:linear-gradient(135deg,var(--accent)33,#151f33)}.head strong{display:block;font-size:15px}.head small{display:block;margin-top:4px;color:#bdc8d7;font-size:11px}.close{border:0;color:#dce7f1;background:transparent;font-size:22px;cursor:pointer}.messages{flex:1;display:grid;align-content:start;gap:10px;padding:16px;overflow:auto}.msg{max-width:86%;padding:11px 12px;border-radius:14px;color:#e9f0f7;background:#172338;font-size:13px;line-height:1.55;white-space:pre-wrap}.msg.user{justify-self:end;color:#07121b;background:var(--accent)}.sources{display:grid;gap:5px;margin-top:9px;color:#a8b6c8;font-size:10px}.sources b{color:var(--accent)}.composer{display:flex;gap:8px;padding:12px;border-top:1px solid #ffffff18}.composer textarea{flex:1;min-height:43px;max-height:100px;resize:none;border:1px solid #ffffff20;border-radius:11px;padding:11px;color:#e9f0f7;background:#111c2e;font:13px inherit}.send{width:43px;border:0;border-radius:11px;color:#07121b;background:var(--accent);font-size:18px;cursor:pointer}.error{padding:8px 16px;color:#ffb7c4;background:#6f183524;font-size:11px}@media(max-width:600px){.wrap.right,.wrap.left{right:10px;left:10px}.panel{width:calc(100vw - 20px);height:calc(100vh - 90px)}.launcher{margin-left:auto}}`;
    shadow.appendChild(style);
    const wrap = document.createElement('div');
    wrap.className = 'wrap right';
    const panel = document.createElement('section');
    panel.className = 'panel hidden';
    panel.setAttribute('aria-label', 'ResolveAI support chat');
    panel.setAttribute('role', 'dialog');
    const head = document.createElement('header');
    head.className = 'head';
    const title = document.createElement('div');
    const close = document.createElement('button');
    close.className = 'close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close support chat');
    close.textContent = '×';
    const list = document.createElement('div');
    list.className = 'messages';
    const error = document.createElement('div');
    error.className = 'error';
    error.hidden = true;
    const composer = document.createElement('form');
    composer.className = 'composer';
    const input = document.createElement('textarea');
    input.maxLength = 4000;
    input.placeholder = 'Ask a question…';
    input.setAttribute('aria-label', 'Message');
    const send = document.createElement('button');
    send.className = 'send';
    send.type = 'submit';
    send.setAttribute('aria-label', 'Send message');
    send.textContent = '↑';
    composer.append(input, send);
    panel.append(head, list, error, composer);
    const launcher = document.createElement('button');
    launcher.className = 'launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-expanded', 'false');
    const bubble = document.createElement('span');
    bubble.className = 'bubble';
    bubble.textContent = '✦';
    const launcherText = document.createElement('span');
    launcherText.textContent = 'Chat';
    launcher.append(bubble, launcherText);
    wrap.append(panel, launcher);
    shadow.appendChild(wrap);
    const setError = (message = '') => { error.textContent = message; error.hidden = !message; };
    const render = () => { list.replaceChildren(...messages.map((message) => { const item = document.createElement('article'); item.className = `msg ${message.role === 'USER' ? 'user' : ''}`; item.textContent = message.content; if (message.sources?.length) {
        const sources = document.createElement('div');
        sources.className = 'sources';
        message.sources.forEach((source) => { const row = document.createElement('div'); const citation = document.createElement('b'); citation.textContent = `[${source.number}]`; row.append(citation, document.createTextNode(` ${source.documentName}`)); sources.appendChild(row); });
        item.appendChild(sources);
    } return item; })); list.scrollTop = list.scrollHeight; };
    const request = async (path, init) => { const response = await fetch(`${apiBase}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } }); const body = await response.json(); if (!response.ok || !body.success)
        throw new Error(body.message ?? 'The support chat is unavailable.'); return body.data; };
    const save = () => localStorage.setItem(storageKey, JSON.stringify({ sessionId, conversationId }));
    const initialize = async () => { try {
        config = await request(`/public/widgets/${encodeURIComponent(widgetId)}/config`);
        if (!config.enabled) {
            launcher.remove();
            return;
        }
        wrap.style.setProperty('--accent', config.accentColor);
        wrap.className = `wrap ${config.position === 'BOTTOM_LEFT' ? 'left' : 'right'}`;
        title.replaceChildren();
        const titleStrong = document.createElement('strong');
        titleStrong.textContent = config.name;
        const agentName = document.createElement('small');
        agentName.textContent = config.agent.name;
        title.append(titleStrong, agentName);
        launcherText.textContent = config.launcherLabel;
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
        const session = await request(`/public/widgets/${encodeURIComponent(widgetId)}/sessions`, { method: 'POST', body: JSON.stringify({ sessionId: saved.sessionId }) });
        sessionId = session.sessionId;
        if (saved.conversationId) {
            conversationId = saved.conversationId;
            messages = await request(`/public/widgets/${encodeURIComponent(widgetId)}/conversations/${conversationId}/messages?sessionId=${encodeURIComponent(sessionId)}`);
        }
        else {
            const conversation = await request(`/public/widgets/${encodeURIComponent(widgetId)}/conversations`, { method: 'POST', body: JSON.stringify({ sessionId, title: 'Visitor support conversation' }) });
            conversationId = conversation.id;
            messages = [{ role: 'ASSISTANT', content: conversation.greeting }];
        }
        save();
        render();
    }
    catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The support chat is unavailable.');
    } };
    const toggle = () => { open = !open; panel.classList.toggle('hidden', !open); launcher.setAttribute('aria-expanded', String(open)); if (open)
        input.focus(); };
    launcher.addEventListener('click', toggle);
    close.addEventListener('click', toggle);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && open)
        toggle(); });
    composer.addEventListener('submit', async (event) => { event.preventDefault(); const content = input.value.trim(); if (!content || busy || !conversationId)
        return; busy = true; setError(); input.value = ''; messages.push({ role: 'USER', content }, { role: 'ASSISTANT', content: '' }); render(); const assistant = messages[messages.length - 1]; try {
        const response = await fetch(`${apiBase}/public/widgets/${encodeURIComponent(widgetId)}/conversations/${conversationId}/messages/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, content }) });
        if (!response.ok || !response.body)
            throw new Error('The support assistant is unavailable.');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
            const chunk = await reader.read();
            if (chunk.done)
                break;
            buffer += decoder.decode(chunk.value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                if (!line)
                    continue;
                const event = JSON.parse(line);
                if (event.type === 'message.delta')
                    assistant.content += event.delta ?? '';
                if (event.type === 'sources')
                    assistant.sources = event.sources;
                if (event.type === 'message.failed')
                    throw new Error(event.error?.message ?? 'The support assistant could not complete this response.');
                render();
            }
        }
    }
    catch (caught) {
        assistant.content = '';
        setError(caught instanceof Error ? caught.message : 'The support assistant is unavailable.');
        render();
    }
    finally {
        busy = false;
        input.focus();
    } });
    void initialize().then(() => { if (script?.dataset.resolveaiOpen === 'true' && config?.enabled)
        toggle(); const demoQuestion = script?.dataset.resolveaiQuestion?.trim(); if (demoQuestion && config?.enabled) {
        input.value = demoQuestion;
        composer.requestSubmit();
    } });
})();
