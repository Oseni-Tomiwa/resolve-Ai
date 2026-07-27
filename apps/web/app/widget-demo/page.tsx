import Script from 'next/script';

export default async function WidgetDemo({ searchParams }: { searchParams: Promise<{ widgetId?: string }> }) {
  const params = await searchParams;
  const widgetId = params.widgetId ?? process.env.NEXT_PUBLIC_DEMO_WIDGET_ID ?? 'replace-with-widget-public-id';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  return <main style={{ minHeight: '100vh', padding: '80px 24px', color: '#eef2ff', background: '#080b14', fontFamily: 'system-ui, sans-serif' }}><div style={{ maxWidth: 760, margin: '0 auto' }}><p style={{ color: '#7ce7dc', letterSpacing: '.12em', textTransform: 'uppercase', fontSize: 12 }}>External customer site demo</p><h1 style={{ marginTop: 14, fontSize: 48, letterSpacing: '-.06em' }}>Your customer experience, with a calmer answer.</h1><p style={{ marginTop: 18, color: '#a8b0c6', lineHeight: 1.7 }}>This page intentionally embeds ResolveAI as a third-party website would. Use the floating launcher to test a public, workspace-scoped support conversation.</p></div><Script src="/widget.js" data-resolveai-widget-id={widgetId} data-resolveai-api={apiUrl} data-resolveai-open="true" data-resolveai-question="What can you help me with?" strategy="afterInteractive" />
  </main>;
}
