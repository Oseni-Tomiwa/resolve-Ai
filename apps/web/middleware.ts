import { NextResponse, type NextRequest } from 'next/server';

const authPaths = ['/login', '/register'];
const hasSession = (request: NextRequest): boolean => Boolean(request.cookies.get('resolveai_access_token')?.value || request.cookies.get('resolveai_refresh_token')?.value);
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function isOnboardingRequired(request: NextRequest): Promise<boolean | null> {
  if (!hasSession(request)) return null;
  try {
    const response = await fetch(`${apiBaseUrl}/auth/me`, { headers: { cookie: request.headers.get('cookie') ?? '' }, cache: 'no-store' });
    if (!response.ok) return null;
    const body = await response.json() as { data?: { onboarding?: { required?: boolean } } };
    return body.data?.onboarding?.required ?? null;
  } catch { return null; }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = hasSession(request);
  const required = await isOnboardingRequired(request);
  if ((pathname.startsWith('/dashboard') || pathname === '/onboarding') && !session) { const url = request.nextUrl.clone(); url.pathname = '/login'; url.searchParams.set('redirect', pathname); return NextResponse.redirect(url); }
  if (pathname.startsWith('/dashboard') && required === true) { const url = request.nextUrl.clone(); url.pathname = '/onboarding'; url.search = ''; return NextResponse.redirect(url); }
  if (pathname === '/onboarding' && required === false) { const url = request.nextUrl.clone(); url.pathname = '/dashboard'; url.search = ''; return NextResponse.redirect(url); }
  if (authPaths.includes(pathname) && session) { const url = request.nextUrl.clone(); url.pathname = required === true ? '/onboarding' : '/dashboard'; url.search = ''; return NextResponse.redirect(url); }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/onboarding', '/login', '/register'] };
