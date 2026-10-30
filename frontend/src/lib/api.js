import { supabase } from './supabase';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '');

export async function apiRequest(path, options = {}) {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();
    const message =
      typeof payload === 'string'
        ? payload
        : payload.message || payload.detail || payload.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (response.status === 204) return null;
  if (response.headers.get('content-type')?.includes('application/json')) return response.json();
  return response.blob();
}

export const api = {
  get: (path) => apiRequest(path),
  post: (path, body) =>
    apiRequest(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: (path, body) =>
    apiRequest(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => apiRequest(path, { method: 'DELETE' }),
};
