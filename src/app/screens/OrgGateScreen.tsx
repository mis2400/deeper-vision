// OrgGateScreen — Backend Phase 1A · BF1A.5.
//
// First time experience after sign in when the operator has no
// organization memberships. Two paths:
//
//   1. Create an organization — they become the owner. Once it's
//      live they're shown an invite code they can share with
//      teammates to bring them in (BF1A.5 acceptance: "a second
//      user joins it").
//
//   2. Join an existing organization — they paste an invite code,
//      hit Join, and the accept_invite RPC inserts their
//      membership.
//
// Honest states: real Supabase errors surfaced verbatim, real
// loading, no fake success. If the operator already has at least
// one membership, the screen redirects to /dashboard immediately
// — this gate is only the first time experience.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Building2, ArrowRight, AlertCircle, Copy, CircleCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { BrandLogo } from '../components/BrandLogo';
import { supabase } from '../lib/supabaseClient';
import {
  fetchMyMemberships,
  createOrganization,
  acceptInvite,
  createInvite,
  type Organization,
} from '../lib/orgs';

type Mode = 'choose' | 'create' | 'join' | 'created';

export function OrgGateScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('choose');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [createdOrg, setCreatedOrg] = useState<Organization | null>(null);
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // On mount: if the user is unauthenticated push them to /login.
  // If the user is authenticated AND has at least one membership,
  // push them to /dashboard. Otherwise show the create / join form.
  // Also subscribe to onAuthStateChange so a sign out elsewhere
  // (other tab, AppShell on a different screen) routes us away
  // cleanly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        navigate('/login', { replace: true });
        return;
      }
      try {
        const memberships = await fetchMyMemberships();
        if (cancelled) return;
        if (memberships.length > 0) {
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch (e: any) {
        setError(e.message ?? String(e));
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') {
        navigate('/login', { replace: true });
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!orgName.trim()) { setError('Give your organization a name.'); return; }
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate('/login', { replace: true });
        return;
      }
      const org = await createOrganization(orgName);
      setCreatedOrg(org);
      // Surface the first invite code right after creation so the
      // operator can hand it to a teammate without a second screen.
      try {
        const code = await createInvite(org.id);
        setGeneratedInviteCode(code);
      } catch (inviteErr: any) {
        // Org is created and owner membership is in. If the invite
        // generate fails, show it but don't block the success path.
        // eslint-disable-next-line no-console
        console.warn('[OrgGate] invite generation failed:', inviteErr);
      }
      setMode('created');
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!inviteCode.trim()) { setError('Paste an invite code.'); return; }
    setLoading(true);
    try {
      await acceptInvite(inviteCode);
      navigate('/dashboard', { replace: true });
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const onCopyCode = async () => {
    if (!generatedInviteCode) return;
    try {
      await navigator.clipboard.writeText(generatedInviteCode);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1500);
    } catch {
      // Clipboard write can fail in headless envs; silently swallow.
    }
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <BrandLogo variant="full" theme="dark" height={28} />
          <p className="mt-4 text-sm text-muted-foreground">
            {mode === 'created'
              ? 'Your workspace is live.'
              : 'Set up your workspace.'}
          </p>
        </div>

        {error && (
          <div className="mb-3 inline-flex items-start gap-1.5 text-[11px] text-rose-600" role="alert" data-testid="orggate-error">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {mode === 'choose' && (
          <div className="space-y-2">
            <button
              type="button"
              data-testid="orggate-pick-create"
              onClick={() => { setMode('create'); setError(null); }}
              className="w-full px-4 py-3 rounded-md border border-border text-left hover:bg-secondary/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Create an organization</span>
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Start fresh. You'll be the owner; you can invite teammates after.
              </p>
            </button>
            <button
              type="button"
              data-testid="orggate-pick-join"
              onClick={() => { setMode('join'); setError(null); }}
              className="w-full px-4 py-3 rounded-md border border-border text-left hover:bg-secondary/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Join an existing organization</span>
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                You'll need an invite code from one of its owners or admins.
              </p>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={onCreate} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Organization name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Access Tech Security"
                autoFocus
                className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
                data-testid="orggate-org-name"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="orggate-submit-create">
              {loading ? 'Creating...' : <>Create organization <ArrowRight className="w-4 h-4 ml-1" /></>}
            </Button>
            <button
              type="button"
              onClick={() => { setMode('choose'); setError(null); }}
              className="block w-full text-[11px] text-muted-foreground hover:text-foreground text-center"
            >
              Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={onJoin} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Invite code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXXXXXX"
                autoFocus
                autoCapitalize="characters"
                spellCheck={false}
                className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:border-primary"
                data-testid="orggate-invite-code"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Twelve characters. Your org owner or admin can generate one for you.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="orggate-submit-join">
              {loading ? 'Joining...' : <>Join organization <ArrowRight className="w-4 h-4 ml-1" /></>}
            </Button>
            <button
              type="button"
              onClick={() => { setMode('choose'); setError(null); }}
              className="block w-full text-[11px] text-muted-foreground hover:text-foreground text-center"
            >
              Back
            </button>
          </form>
        )}

        {mode === 'created' && createdOrg && (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-md border border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center gap-2">
                <CircleCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium">{createdOrg.name}</span>
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                You're the owner. Workspace is ready.
              </p>
            </div>

            {generatedInviteCode ? (
              <div className="px-4 py-3 rounded-md border border-border bg-card">
                <p className="text-[12px] font-medium">Invite a teammate</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Share this code with one teammate. It expires in 7 days.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code
                    className="flex-1 px-2.5 py-1.5 rounded-md bg-secondary/40 text-sm font-mono tracking-widest text-foreground select-all"
                    data-testid="orggate-invite-code-display"
                  >
                    {generatedInviteCode}
                  </code>
                  <button
                    type="button"
                    onClick={onCopyCode}
                    title={inviteCopied ? 'Copied' : 'Copy code'}
                    className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                    data-testid="orggate-invite-copy"
                  >
                    {inviteCopied ? <CircleCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : null}

            <Button
              type="button"
              className="w-full"
              onClick={() => navigate('/dashboard', { replace: true })}
              data-testid="orggate-continue"
            >
              Continue to dashboard <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
