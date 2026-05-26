// AuthGate — Backend Phase 1A · BF1A.6.
//
// UX layer gate around every authenticated route. States:
//
//   - checking     : initial async check in flight; loading frame.
//   - no-session   : no Supabase session; bounce to /login.
//   - no-org       : session present but zero memberships; bounce
//                    to /org/setup.
//   - ready        : session + at least one membership; render
//                    children.
//   - check-error  : membership query failed (network / transient);
//                    render an inline retry rather than fail closed
//                    to /login (which would loop on a flaky network).
//
// IMPORTANT scope note for Phase 1A: this gate is purely a routing
// gate. The design data behind it (projects, devices, pathways, the
// whole Zustand store) STAYS in localStorage. The gate enforces
// presence of a Supabase session + an organization membership; it
// does NOT touch any design data and does NOT block localStorage
// access. Phase 1B moves the design data to Postgres and lets RLS
// take over the real isolation.
//
// Auth state changes from elsewhere in the app (sign out via
// AppShell, sign in in another tab) flow through onAuthStateChange
// so the gate re-evaluates without a manual route push. SIGNED_OUT
// renders the loading frame synchronously to avoid a one-frame
// flash of protected content before the redirect lands.

import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { fetchMyMemberships } from '../lib/orgs';

interface Props {
  children?: React.ReactNode;
}

/** AuthGateLayout — pair this with a parent `<Route element={...}>`
 *  in react-router so every child route renders behind the gate. */
export function AuthGateLayout() {
  return (
    <AuthGate>
      <Outlet />
    </AuthGate>
  );
}

type GateState =
  | { kind: 'checking' }
  | { kind: 'no-session' }
  | { kind: 'no-org' }
  | { kind: 'ready' }
  | { kind: 'check-error'; message: string };

/** Audit-only bypass. Set by scripts/audit-runtime.mjs via puppeteer's
 *  `evaluateOnNewDocument` BEFORE the page loads. The flag is read once
 *  at component init so the gate doesn't bounce to /login before the
 *  audit can exercise the actual routes.
 *
 *  Hostname-gated. The bypass is INERT on any deployed domain. A user
 *  who opens devtools on the live site (vercel.app or the custom domain)
 *  and sets dv-audit-bypass=true CANNOT skip AuthGate: window.location
 *  .hostname is not localhost, so this returns false before the
 *  localStorage read. The runtime audit hits vite preview at
 *  localhost:4173, where the hostname check passes and the flag works.
 *  Same bundle ships to prod and runs in the audit, so the audit still
 *  exercises the real deploy artifact.
 *
 *  Threat model the gate covers:
 *    real user sets dv-audit-bypass=true on the live site → hostname is
 *    not localhost → returns false → AuthGate runs the real Supabase
 *    session check → no session → redirects to /login. The flag has no
 *    effect outside localhost.
 *
 *  Threat model the gate does NOT need to cover:
 *    someone running their own localhost copy pointed at their own
 *    backend. They already control the entire client. The real security
 *    boundary on user data is Supabase RLS, not this UI gate.
 */
function isAuditBypass(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    // Inert on every deployed domain. Audit and local dev hit localhost.
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0') return false;
    return window.localStorage?.getItem('dv-audit-bypass') === 'true';
  } catch {
    return false;
  }
}

export function AuthGate({ children }: Props) {
  const navigate = useNavigate();
  const [state, setState] = useState<GateState>(() => (isAuditBypass() ? { kind: 'ready' } : { kind: 'checking' }));

  const evaluate = useCallback(async (signal?: { cancelled: boolean }) => {
    if (isAuditBypass()) {
      if (signal?.cancelled) return;
      setState({ kind: 'ready' });
      return;
    }
    if (!supabaseConfigured) {
      if (signal?.cancelled) return;
      setState({ kind: 'no-session' });
      navigate('/login', { replace: true, state: { from: window.location.pathname } });
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (signal?.cancelled) return;
    if (!data.session) {
      setState({ kind: 'no-session' });
      navigate('/login', { replace: true, state: { from: window.location.pathname } });
      return;
    }
    try {
      const memberships = await fetchMyMemberships();
      if (signal?.cancelled) return;
      if (memberships.length === 0) {
        setState({ kind: 'no-org' });
        navigate('/org/setup', { replace: true, state: { from: window.location.pathname } });
        return;
      }
      setState({ kind: 'ready' });
    } catch (e: any) {
      // Distinguish transport / RLS errors from auth-actually-broken.
      // We have a valid session; the membership query failed (network
      // hiccup, transient Supabase 5xx, RLS regression). Stay on the
      // gate and offer a retry rather than bouncing to /login, which
      // would loop because the existing-session redirect on the login
      // screen would push us right back here.
      if (signal?.cancelled) return;
      setState({ kind: 'check-error', message: e?.message ?? String(e) });
    }
  }, [navigate]);

  useEffect(() => {
    const signal = { cancelled: false };
    evaluate(signal);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (signal.cancelled) return;
      // Audit bypass also suppresses the onAuthStateChange redirect.
      // The default case below fires on INITIAL_SESSION when there's
      // no real Supabase session, which would otherwise push the
      // headless browser to /login even after evaluate() returned
      // 'ready'.
      if (isAuditBypass()) return;
      switch (event) {
        case 'SIGNED_OUT': {
          // Render the loading frame synchronously to avoid a one
          // frame flash of children mounted against a null session
          // before the route push lands.
          setState({ kind: 'checking' });
          navigate('/login', { replace: true });
          return;
        }
        case 'SIGNED_IN': {
          // A user signed in (e.g. from another tab). Re-run the
          // membership check from scratch so the gate reflects the
          // new identity rather than the stale one.
          setState({ kind: 'checking' });
          evaluate(signal);
          return;
        }
        case 'USER_UPDATED': {
          // The user metadata changed (e.g. profile patch). The
          // session is still valid; nothing to do here.
          return;
        }
        // TOKEN_REFRESHED, PASSWORD_RECOVERY, INITIAL_SESSION: no op.
        default: {
          if (!session && state.kind === 'ready') {
            // Defensive: if any event arrives with no session while
            // we're rendering protected content, treat as signed out.
            setState({ kind: 'checking' });
            navigate('/login', { replace: true });
          }
          return;
        }
      }
    });

    return () => {
      signal.cancelled = true;
      sub.subscription.unsubscribe();
    };
    // navigate identity is stable across renders; location.pathname
    // is read via window.location at call time so it's always fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluate]);

  if (state.kind === 'check-error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <div className="inline-flex w-10 h-10 rounded-full bg-amber-500/10 items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="mt-3 text-sm font-medium">Couldn't reach your workspace</h2>
          <p className="mt-2 text-[12px] text-muted-foreground">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => { setState({ kind: 'checking' }); evaluate(); }}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[12px] hover:bg-secondary/40 transition-colors"
            data-testid="authgate-retry"
          >
            <RotateCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (state.kind !== 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
