const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type RequestOptions = { retryOnUnauthorized?: boolean };
type SessionFailureHandler = () => void;

let refreshPromise: Promise<boolean> | null = null;
let sessionFailureHandler: SessionFailureHandler | null = null;

export function registerSessionFailureHandler(handler: SessionFailureHandler): () => void {
  sessionFailureHandler = handler;
  return () => {
    if (sessionFailureHandler === handler) sessionFailureHandler = null;
  };
}

function requestInit(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return {
    ...init,
    credentials: 'include',
    headers,
  };
}

async function refreshAccess(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${apiBaseUrl}/auth/refresh`, requestInit({ method: 'POST', body: JSON.stringify({}) }))
      .then(async (response) => {
        if (!response.ok) return false;
        try {
          const body = await response.json() as { success?: boolean };
          return body.success === true;
        } catch {
          return false;
        }
      })
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiFetch(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<Response> {
  const response = await fetch(`${apiBaseUrl}${path}`, requestInit(init));
  if (response.status !== 401 || options.retryOnUnauthorized === false) return response;

  if (await refreshAccess()) {
    const retried = await fetch(`${apiBaseUrl}${path}`, requestInit(init));
    if (retried.status === 401) sessionFailureHandler?.();
    return retried;
  }

  sessionFailureHandler?.();
  return response;
}

export async function apiRequest<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
  const response = await apiFetch(path, init, options);
  let body: { success: boolean; message?: string; data?: T };
  try {
    body = await response.json() as { success: boolean; message?: string; data?: T };
  } catch {
    throw new Error(response.ok ? 'The API returned an invalid response.' : `The request failed with status ${response.status}.`);
  }
  if (!response.ok || !body.success || body.data === undefined) throw new Error(body.message ?? 'The request could not be completed.');
  return body.data;
}
