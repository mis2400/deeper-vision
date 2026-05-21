// Supabase client — single browser side instance for the SPA.
//
// Backend Phase 1A scope: this module is responsible only for auth +
// organization data (profiles, organizations, organization_members).
// All design data (projects, devices, pathways, etc.) STAYS in
// localStorage in 1A; 1B migrates that to Postgres.
//
// Key model — current Supabase publishable + secret key system:
//   - VITE_SUPABASE_PUBLISHABLE_KEY: safe in the browser. Row Level
//     Security in Postgres is the real boundary. Replaces the legacy
//     `anon` key.
//   - service role / secret key: NEVER in the SPA. Not imported here,
//     not referenced anywhere in this repo.
//
// Both env vars come from .env.local (gitignored). Vite exposes them
// via `import.meta.env` because of the VITE_ prefix.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  // Don't throw at module load — the build needs to succeed even when
  // env vars are absent (e.g. a Vercel deploy preview without secrets).
  // Surface the misconfiguration in the console so any auth call fails
  // loudly rather than silently.
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY missing. '
    + 'Auth and tenancy features will not work until these are set in .env.local.'
  );
}

/** The shared Supabase client instance. Holds the session in
 *  localStorage by default; `persistSession: true` plus
 *  `autoRefreshToken: true` keeps the operator signed in across
 *  refreshes per the BF1A.4 acceptance criteria. */
export const supabase: SupabaseClient = createClient(url ?? '', publishableKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** True when env vars are present. The Login screen flips honest
 *  states off this — when false, sign in cannot work and the UI
 *  should say so plainly. */
export const supabaseConfigured: boolean = !!(url && publishableKey);

/** Lightweight health check used by BF1A.1 verification. Returns
 *  `{ ok: true }` when a session lookup completes (the actual session
 *  may be null — that's fine; we just want to confirm the client can
 *  reach Supabase). Returns `{ ok: false, error }` on transport
 *  failure. */
export async function checkSupabaseHealth(): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) {
    return { ok: false, error: 'Supabase env vars not set.' };
  }
  try {
    const { error } = await supabase.auth.getSession();
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}
