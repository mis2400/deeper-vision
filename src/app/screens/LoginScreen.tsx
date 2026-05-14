import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { BrandLogo } from '../components/BrandLogo';
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

/** Demo credentials advertised publicly on the login page so any reviewer
 *  (human or AI browser) can step in without friction. Any other input also
 *  works — the form has no real auth backend yet. */
const DEMO_EMAIL = 'demo@deepervision.ai';
const DEMO_PASSWORD = 'Demo123!';

export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/projects');
  };
  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    // Auto-submit a tick later so the field updates render first.
    setTimeout(() => navigate('/projects'), 60);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <BrandLogo variant="full" theme="dark" height={28} />
            <p className="mt-4 text-sm text-muted-foreground">Engineering OS for physical security.</p>
          </div>

          {/* Public-demo affordance. Auto-fills the demo credentials and signs
              the visitor straight in — no manual typing, no friction for
              reviewers and AI browsers. Any other email/password also works
              (no backend auth yet) so this is purely a UX shortcut. */}
          <button
            type="button"
            onClick={fillDemo}
            className="w-full mb-5 px-3 py-2.5 rounded-md border border-primary/40 bg-primary/5 hover:bg-primary/10 text-left transition-colors group"
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

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Work email</label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@firm.com"
                  className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Password</label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Sign in <ArrowRight className="w-4 h-4 ml-1" />
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider"><span className="bg-background px-2 text-muted-foreground">or</span></div>
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/projects')}>
              Continue with SSO
            </Button>
          </form>

          <p className="mt-8 text-xs text-muted-foreground">
            No account? <button onClick={() => navigate('/projects')} className="text-primary hover:underline">Request access</button>
          </p>
        </div>
      </div>

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
