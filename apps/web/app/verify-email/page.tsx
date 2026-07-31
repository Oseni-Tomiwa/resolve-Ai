'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { apiRequest } from '../api-client';

function VerifyEmailContent() {
  const params = useSearchParams(); const router = useRouter(); const initial = params.get('token') ?? ''; const [token, setToken] = useState(initial); const [email, setEmail] = useState(params.get('email') ?? ''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function verify(): Promise<void> { setBusy(true); setError(''); try { await apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }); const invitation = params.get('invitation'); if (invitation) await apiRequest('/workspace-invitations/accept', { method: 'POST', body: JSON.stringify({ token: invitation }) }); setMessage(invitation ? 'Email verified and invitation accepted. You can now sign in.' : 'Email verified. You can now sign in.'); setTimeout(() => router.replace('/login'), 700); } catch (caught) { setError(caught instanceof Error ? caught.message : 'This link is invalid or expired.'); } finally { setBusy(false); } }
  async function resend(): Promise<void> { setBusy(true); setError(''); try { await apiRequest('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }); setMessage('If the account needs verification, a new email has been sent.'); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to resend the email.'); } finally { setBusy(false); } }
  return <div className="auth-layout"><main className="auth-card"><p className="eyebrow">Account security</p><h1>Verify your email</h1><p>Use the link from your email to activate your ResolveAI account.</p><label>Verification token<input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste your verification token" /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-notice" role="status">{message}</p>}<button className="button auth-submit" type="button" disabled={busy || token.length < 20} onClick={() => void verify()}>{busy ? 'Verifying…' : 'Verify email'}</button><hr /><label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label><button className="text-link" type="button" disabled={busy || !email} onClick={() => void resend()}>Resend verification email</button><p className="auth-switch"><Link href="/login">Back to sign in</Link></p></main></div>;
}

export default function VerifyEmailPage() { return <Suspense fallback={<div className="auth-layout"><main className="auth-card"><p className="auth-loading">Loading verification…</p></main></div>}><VerifyEmailContent /></Suspense>; }
