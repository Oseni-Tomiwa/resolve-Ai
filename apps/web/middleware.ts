import { NextResponse, type NextRequest } from 'next/server';

const authPaths = ['/login', '/register'];
const hasSessionCookie = (request: NextRequest): boolean => Boolean(request.cookies.get('resolveai_access_token')?.value || request.cookies.get('resolveai_refresh_token')?.value);
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function getSession(request: NextRequest): Promise<{ authenticated: boolean; onboardingRequired: boolean | null }> {
  if (!hasSessionCookie(request)) return { authenticated: false, onboardingRequired: null };
  try {
    const response = await fetch(`${apiBaseUrl}/auth/me`, { headers: { cookie: request.headers.get('cookie') ?? '' }, cache: 'no-store' });
    if (!response.ok) return { authenticated: false, onboardingRequired: null };
    const body = await response.json() as { data?: { onboarding?: { required?: boolean } } };
    return { authenticated: true, onboardingRequired: body.data?.onboarding?.required ?? null };
  } catch { return { authenticated: false, onboardingRequired: null }; }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasCookie = hasSessionCookie(request);
  const session = await getSession(request);
  if ((pathname.startsWith('/dashboard') || pathname === '/onboarding') && !hasCookie) { const url = request.nextUrl.clone(); url.pathname = '/login'; url.searchParams.set('redirect', pathname); return NextResponse.redirect(url); }
  if (pathname.startsWith('/dashboard') && session.authenticated && session.onboardingRequired === true) { const url = request.nextUrl.clone(); url.pathname = '/onboarding'; url.search = ''; return NextResponse.redirect(url); }
  if (pathname === '/onboarding' && session.authenticated && session.onboardingRequired === false) { const url = request.nextUrl.clone(); url.pathname = '/dashboard'; url.search = ''; return NextResponse.redirect(url); }
  if (authPaths.includes(pathname) && session.authenticated) { const url = request.nextUrl.clone(); url.pathname = session.onboardingRequired === true ? '/onboarding' : '/dashboard'; url.search = ''; return NextResponse.redirect(url); }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/onboarding', '/login', '/register'] };
