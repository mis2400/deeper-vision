// LoginScreen — Backend Phase 1A · BF1A.4 (real Supabase Auth).
//
// Email + password sign in, sign up, and password reset flows backed
// by Supabase Auth. Honest states throughout: real Supabase errors
// surfaced verbatim, real loading on every async call, real session
// (persistSession + autoRefreshToken on the client mean refresh
// keeps the operator signed in).
//
// On sign up: Supabase fires the on_auth_user_created trigger which
// inserts the matching profiles row. No client side profile write
// needed.
//
// Honest deferrals — these affordances ARE NOT rendered today
// because they would require backend work that hasn't landed:
//   - SSO (Google / Microsoft / SAML): hidden until OAuth providers
//     are configured in Supabase and tested end to end. Adding a
//     fake button that toasts "saved locally" violates the honesty
//     contract.
//   - Public demo one-click: hidden. The demo credentials don't
//     correspond to a real Supabase user. Reviewers sign up like
//     any other operator.
//   - Forgot password: hidden until the SMTP provider is wired
//     (Phase 1B). Supabase's resetPasswordForEmail returns 200
//     even when no email gets sent, so the user would see a
//     success toast for an email that never arrives. That's worse
//     than not offering it.
//
// Post sign in routing: navigate to /dashboard. BF1A.6 layers the
// org gate on top — a user with no organization gets routed to the
// org create / join flow first.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { BrandLogo } from '../components/BrandLogo';
import { Mail, Lock, ArrowRight, User as UserIcon, AlertCircle, MailCheck } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabaseClient';

type Mode = 'sign-in' | 'create-account';

export function LoginScreen() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  // After sign up when email confirmation is required, the form
  // flips to a "Check your email" state so the operator doesn't
  // think they're signed in.
  const [signedUpAwaitingConfirm, setSignedUpAwaitingConfirm] = useState<string | null>(null);

  // If the operator is already signed in, skip the login form entirely.
  // Handles the refresh on an authenticated session AND a sign in
  // that happens in another tab (the supabase client mirrors the
  // session across tabs by listening to localStorage events).
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) navigate('/dashboard', { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_IN' && session) {
        navigate('/dashboard', { replace: true });
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supabaseConfigured) {
      setError('Auth is not configured on this build. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
      return;
    }
    if (!validEmail(email)) { setError('Enter a valid email.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supabaseConfigured) {
      setError('Auth is not configured on this build. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
      return;
    }
    if (!fullName.trim())     { setError('Tell us your name.'); return; }
    if (!validEmail(email))   { setError('Enter a valid email.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: fullName.trim() },
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Two possible Supabase outcomes:
    //   1. Email confirmation required: session is null, user.confirmed_at
    //      is null. Show "Check your email" and stay on the form.
    //   2. Auto confirm on: session is present, user is fully active.
    //      Navigate straight in.
    if (data.session) {
      navigate('/dashboard', { replace: true });
      return;
    }
    setSignedUpAwaitingConfirm(email);
  };

  // ── "Check your email" state after sign up ────────────────────────
  if (signedUpAwaitingConfirm) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <BrandLogo variant="full" theme="dark" height={28} />
          <div className="mt-8 inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <MailCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="mt-4 text-lg font-medium">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <span className="text-foreground">{signedUpAwaitingConfirm}</span>. Click it to activate your account, then sign in.
          </p>
          <button
            type="button"
            onClick={() => {
              setSignedUpAwaitingConfirm(null);
              setMode('sign-in');
              setError(null);
              setPassword('');
            }}
            className="mt-6 text-sm text-primary hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <BrandLogo variant="full" theme="dark" height={28} />
            <p className="mt-4 text-sm text-muted-foreground">Engineering OS for physical security.</p>
          </div>

          {/* Sign in / Create account tabs */}
          <div className="inline-flex rounded-md border border-border bg-background overflow-hidden text-[12px] mb-4">
            <button
              type="button"
              onClick={() => { setMode('sign-in'); setError(null); }}
              className={`px-3 py-1.5 transition-colors ${mode === 'sign-in' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/40 text-muted-foreground'}`}
              data-testid="login-tab-signin"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode('create-account'); setError(null); }}
              className={`px-3 py-1.5 transition-colors ${mode === 'create-account' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/40 text-muted-foreground'}`}
              data-testid="login-tab-create"
            >
              Create account
            </button>
          </div>

          {error && (
            <div className="mb-3 inline-flex items-start gap-1.5 text-[11px] text-rose-600" role="alert" data-testid="login-error">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {mode === 'sign-in' && (
            <form onSubmit={onSignIn} className="space-y-3">
              <FieldEmail value={email} onChange={setEmail} />
              <FieldPassword value={password} onChange={setPassword} />
              <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit">
                {loading ? 'Signing in...' : <>Sign in <ArrowRight className="w-4 h-4 ml-1" /></>}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                No account? <button type="button" onClick={() => { setError(null); setMode('create-account'); }} className="text-primary hover:underline">Create one</button>
              </p>
            </form>
          )}

          {mode === 'create-account' && (
            <form onSubmit={onCreate} className="space-y-3">
              <FieldName value={fullName} onChange={setFullName} />
              <FieldEmail value={email} onChange={setEmail} />
              <FieldPassword value={password} onChange={setPassword} hint="At least 8 characters." />
              <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit">
                {loading ? 'Creating...' : <>Create account <ArrowRight className="w-4 h-4 ml-1" /></>}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Already have an account? <button type="button" onClick={() => { setError(null); setMode('sign-in'); }} className="text-primary hover:underline">Sign in</button>
              </p>
            </form>
          )}

          <div className="mt-10 text-[10px] text-muted-foreground/80 text-center leading-relaxed">
            By continuing you agree to our terms and the privacy notice.
          </div>
        </div>
      </div>

      {/* Brand panel — visual only. */}
      <div className="hidden lg:flex flex-1 border-l border-border items-center justify-center relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full opacity-40" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 800">
          <defs>
            <pattern id="login-dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#30363D" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-dots)" />
          <rect x="180" y="180" width="440" height="440" fill="none" stroke="#30363D" strokeWidth="1.5" />
          <line x1="180" y1="380" x2="620" y2="380" stroke="#30363D" strokeWidth="1" />
          <line x1="400" y1="180" x2="400" y2="380" stroke="#30363D" strokeWidth="1" />
          <circle cx="280" cy="280" r="6" fill="#2F81F7" />
          <circle cx="520" cy="280" r="6" fill="#2F81F7" />
          <circle cx="280" cy="500" r="6" fill="#3FB950" />
          <circle cx="520" cy="500" r="6" fill="#3FB950" />
        </svg>
        <div className="relative z-10 max-w-sm text-center px-8">
          <h2 className="text-2xl font-medium tracking-tight">Design, document, deploy.</h2>
          <p className="mt-3 text-sm text-muted-foreground">One workspace from kickoff to commissioning. Cameras, doors, cable, code — all in sync.</p>
        </div>
      </div>
    </div>
  );
}

function FieldEmail({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">Email</label>
      <div className="mt-1 relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="you@firm.com"
          autoComplete="email"
          className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
          data-testid="login-email"
        />
      </div>
    </div>
  );
}

function FieldPassword({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-xs text-muted-foreground">Password</label>
      <div className="mt-1 relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete={hint ? 'new-password' : 'current-password'}
          className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-10 py-2 text-sm focus:outline-none focus:border-primary"
          data-testid="login-password"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function FieldName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">Full name</label>
      <div className="mt-1 relative">
        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Jamie Rivera"
          autoComplete="name"
          className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
          data-testid="login-fullname"
        />
      </div>
    </div>
  );
}
