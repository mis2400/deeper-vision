// LoginScreen — Phase 4A.
// Sign in / Create account / Forgot password flows with SSO buttons.
// No real auth backend; persistence is local (writes the operator's
// email + name into userPrefs so the rest of the app reads it).
// Every backend gap is honest about what works today.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { BrandLogo } from '../components/BrandLogo';
import { Mail, Lock, ArrowRight, Sparkles, User as UserIcon, KeyRound, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { toast } from 'sonner';

/** Demo credentials advertised publicly on the login page so any
 *  reviewer (human or AI browser) can step in without friction. Any
 *  other input also works — the form has no real auth backend yet. */
const DEMO_EMAIL    = 'demo@deepervision.ai';
const DEMO_PASSWORD = 'Demo123!';

type Mode = 'sign-in' | 'create-account' | 'forgot';

export function LoginScreen() {
  const navigate = useNavigate();
  const setUserPrefs = useProjectStore((s) => s.setUserPrefs);

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError]       = useState<string | null>(null);

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const onSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validEmail(email)) return setError('Enter a valid work email.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    // Local-only "sign in": write the email into userPrefs so the
    // rest of the app reads the operator's identity. Real session
    // tokens land with the auth backend.
    setUserPrefs({ email });
    toast.success('Signed in.', { duration: 2000 });
    navigate('/dashboard');
  };

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) return setError('Tell us your name.');
    if (!validEmail(email)) return setError('Enter a valid work email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setUserPrefs({ email, fullName: fullName.trim() });
    toast.success(`Account created for ${email}. Real provisioning + verification lands with the auth backend.`, { duration: 4000 });
    navigate('/dashboard');
  };

  const onForgot = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validEmail(email)) return setError('Enter the email on your account.');
    toast.success(`Reset link queued for ${email}. Real delivery lands with the auth backend.`, { duration: 4500 });
    setMode('sign-in');
  };

  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setUserPrefs({ email: DEMO_EMAIL, fullName: 'Demo operator' });
    setTimeout(() => navigate('/dashboard'), 60);
  };

  const onSso = (provider: 'google' | 'microsoft' | 'saml') => {
    const label = provider === 'google' ? 'Google' : provider === 'microsoft' ? 'Microsoft' : 'your IdP';
    toast.success(`${label} sign in saved locally. Real OAuth lands with the auth backend.`, { duration: 3500 });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <BrandLogo variant="full" theme="dark" height={28} />
            <p className="mt-4 text-sm text-muted-foreground">Engineering OS for physical security.</p>
          </div>

          {/* Public-demo affordance. */}
          {mode !== 'forgot' && (
            <button
              type="button"
              onClick={fillDemo}
              className="w-full mb-5 px-3 py-2.5 rounded-md border border-primary/40 bg-primary/5 hover:bg-primary/10 text-left transition-colors group"
              data-testid="login-demo"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">Try the demo · one click</span>
                <ArrowRight className="w-3.5 h-3.5 text-primary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
                <span>email</span>    <span className="text-foreground">{DEMO_EMAIL}</span>
                <span>password</span> <span className="text-foreground">{DEMO_PASSWORD}</span>
              </div>
            </button>
          )}

          {/* Sign in / Create account tabs */}
          {mode !== 'forgot' && (
            <div className="inline-flex rounded-md border border-border bg-background overflow-hidden text-[12px] mb-4">
              <button
                onClick={() => { setMode('sign-in'); setError(null); }}
                className={`px-3 py-1.5 transition-colors ${mode === 'sign-in' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/40 text-muted-foreground'}`}
                data-testid="login-tab-signin"
              >
                Sign in
              </button>
              <button
                onClick={() => { setMode('create-account'); setError(null); }}
                className={`px-3 py-1.5 transition-colors ${mode === 'create-account' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/40 text-muted-foreground'}`}
                data-testid="login-tab-create"
              >
                Create account
              </button>
            </div>
          )}

          {error && (
            <div className="mb-3 inline-flex items-start gap-1.5 text-[11px] text-rose-600" role="alert">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {mode === 'sign-in' && (
            <form onSubmit={onSignIn} className="space-y-3">
              <FieldEmail value={email} onChange={setEmail} />
              <FieldPassword value={password} onChange={setPassword} />
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => { setError(null); setMode('forgot'); }} className="text-[11px] text-primary hover:underline" data-testid="login-forgot">Forgot password?</button>
              </div>
              <Button type="submit" className="w-full">Sign in <ArrowRight className="w-4 h-4 ml-1" /></Button>
              <SsoRow onSso={onSso} />
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
              <Button type="submit" className="w-full">Create account <ArrowRight className="w-4 h-4 ml-1" /></Button>
              <SsoRow onSso={onSso} />
              <p className="text-[11px] text-muted-foreground text-center">
                Already on DeeperVision? <button type="button" onClick={() => { setError(null); setMode('sign-in'); }} className="text-primary hover:underline">Sign in</button>
              </p>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={onForgot} className="space-y-3">
              <div className="mb-1">
                <div className="text-sm font-medium">Reset your password</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Enter your account email. We send a reset link with one-time use.</div>
              </div>
              <FieldEmail value={email} onChange={setEmail} />
              <Button type="submit" className="w-full"><KeyRound className="w-3.5 h-3.5 mr-1" />Send reset link</Button>
              <button type="button" onClick={() => { setError(null); setMode('sign-in'); }} className="block w-full text-[11px] text-muted-foreground hover:text-foreground text-center">Back to sign in</button>
            </form>
          )}

          <div className="mt-10 text-[10px] text-muted-foreground/80 text-center leading-relaxed">
            By continuing you agree to our terms and the privacy notice. Local persistence only until the auth backend ships.
          </div>
        </div>
      </div>

      {/* Brand panel — kept from the prior login. */}
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
      <label className="text-xs text-muted-foreground">Work email</label>
      <div className="mt-1 relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="you@firm.com"
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
          className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
          data-testid="login-fullname"
        />
      </div>
    </div>
  );
}

function SsoRow({ onSso }: { onSso: (p: 'google' | 'microsoft' | 'saml') => void }) {
  return (
    <>
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-[10px] uppercase tracking-wider"><span className="bg-background px-2 text-muted-foreground">or continue with</span></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => onSso('google')} data-testid="login-sso-google">
          <GoogleGlyph className="w-3.5 h-3.5 mr-1.5" />Google
        </Button>
        <Button type="button" variant="outline" onClick={() => onSso('microsoft')} data-testid="login-sso-microsoft">
          <MicrosoftGlyph className="w-3.5 h-3.5 mr-1.5" />Microsoft
        </Button>
      </div>
      <Button type="button" variant="outline" className="w-full mt-2" onClick={() => onSso('saml')} data-testid="login-sso-saml">
        SAML SSO
      </Button>
    </>
  );
}

// Inline SVG glyphs so we don't ship a logo bitmap. Recognizable
// without being a trademarked asset.
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC04" d="M3.95 10.7A5.41 5.41 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

function MicrosoftGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="0" y="0" width="7.5" height="7.5" fill="#F35325" />
      <rect x="8.5" y="0" width="7.5" height="7.5" fill="#81BC06" />
      <rect x="0" y="8.5" width="7.5" height="7.5" fill="#05A6F0" />
      <rect x="8.5" y="8.5" width="7.5" height="7.5" fill="#FFBA08" />
    </svg>
  );
}
