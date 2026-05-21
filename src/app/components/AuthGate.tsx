// AuthGate — Backend Phase 1A · BF1A.6.
//
// UX layer gate around every authenticated route. Three states:
//
//   1. No session (signed out) -> redirect to /login.
//   2. Session, no memberships -> redirect to /org/setup.
//   3. Session + at least one membership -> render children.
//
// IMPORTANT scope note for 1A: this gate is purely a routing gate.
// The design data behind it (projects, devices, pathways, the whole
// Zustand store) STAYS in localStorage in 1A. The gate enforces
// presence of a Supabase session + organization membership; it does
// not touch any design data and does not block access to localStorage.
// 1B will move the design data to Postgres and let RLS take over.
//
// Auth state changes (sign in / sign out elsewhere in the app) flow
// through onAuthStateChange so the gate re-evaluates without a
// manual route push.

import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
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
  | { kind: 'ready' };

export function AuthGate({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<GateState>({ kind: 'checking' });

  useEffect(() => {
    if (!supabaseConfigured) {
      // Mirror the LoginScreen's behavior — without env vars, fall
      // through to /login which renders its own honest error.
      setState({ kind: 'no-session' });
      navigate('/login', { replace: true, state: { from: location.pathname } });
      return;
    }

    let cancelled = false;

    const evaluate = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setState({ kind: 'no-session' });
        navigate('/login', { replace: true, state: { from: location.pathname } });
        return;
      }
      try {
        const memberships = await fetchMyMemberships();
        if (cancelled) return;
        if (memberships.length === 0) {
          setState({ kind: 'no-org' });
          navigate('/org/setup', { replace: true, state: { from: location.pathname } });
          return;
        }
        setState({ kind: 'ready' });
      } catch (e) {
        // If the membership query errored (network, RLS misconfig),
        // fail closed — push the user back to login rather than
        // letting them through with an unverified org boundary.
        // eslint-disable-next-line no-console
        console.warn('[AuthGate] membership check failed:', e);
        setState({ kind: 'no-session' });
        navigate('/login', { replace: true, state: { from: location.pathname } });
      }
    };

    evaluate();

    // React to sign in / sign out events from elsewhere in the app
    // (e.g. the future sign out button in the app shell). When a
    // user signs out, the session vanishes and we want the gate to
    // bounce them to /login immediately.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') {
        setState({ kind: 'no-session' });
        navigate('/login', { replace: true });
      }
      // SIGNED_IN and TOKEN_REFRESHED already keep the session
      // current; re-running evaluate would just reroute to the same
      // place. Skip them.
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  // location.pathname intentionally omitted from deps — we don't
  // want to re-run the whole evaluate on every internal navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  if (state.kind !== 'ready') {
    // Brief loading frame so the unauthenticated user doesn't see a
    // flash of protected content before the redirect.
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
