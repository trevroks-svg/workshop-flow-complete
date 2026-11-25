/**
 * src/lib/apiFetch.js
 *
 * Drop-in replacement for fetch() when calling our own Express API
 * (/api/...). Attaches the current Supabase session's access token as
 * `Authorization: Bearer <token>` so the server's requireAuth middleware
 * (server/middleware/requireAuth.js) can verify who is calling.
 *
 * Same signature as fetch: apiFetch(path, options). If there is no session
 * (e.g. signed out) the request is sent without a token and the server
 * answers 401 — callers already treat a non-OK response as a failure and
 * fall back to their local behaviour.
 */

import { supabase } from '@/api/supabaseClient';

export async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { ...(options.headers || {}) };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return fetch(path, { ...options, headers });
}
