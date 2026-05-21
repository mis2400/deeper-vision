// Organization data access — Backend Phase 1A.
//
// Thin wrappers around the Supabase calls the org gate + auth gate
// need. Every call returns a typed result; errors are passed through
// verbatim so the UI can surface them honestly.

import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';

export interface Membership {
  organization_id: string;
  user_id: string;
  org_role: 'owner' | 'admin' | 'member';
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  created_by: string | null;
}

export interface MembershipWithOrg extends Membership {
  organization: Organization;
}

/** Fetch all memberships for the current session's user, with the
 *  joined organization rows so the caller can show org names in the
 *  switcher without a second round trip. */
export async function fetchMyMemberships(): Promise<MembershipWithOrg[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, user_id, org_role, created_at, organization:organizations (id, name, slug, created_at, created_by)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  // The PostgREST embed returns the joined org as a single object
  // when the foreign key target is unique. Cast through unknown
  // because supabase-js's generic typing for embeds is generic
  // by default.
  return (data ?? []).map((row: any) => ({
    organization_id: row.organization_id,
    user_id: row.user_id,
    org_role: row.org_role,
    created_at: row.created_at,
    organization: row.organization,
  }));
}

/** Slugify a free form org name into the canonical lower-kebab-case
 *  shape we store on `organizations.slug`. Adds a short random tail
 *  so collisions are rare for orgs that happen to pick the same
 *  name. */
export function slugify(name: string): string {
  const base = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'org';
  const tail = Math.random().toString(36).slice(2, 6);
  return `${base}-${tail}`;
}

/** Create a new organization with the calling user as the owner.
 *  Two inserts: the org row (created_by must equal auth.uid() per
 *  RLS) then the owner membership row (the bootstrap policy allows
 *  this when the org has no existing members). */
export async function createOrganization(session: Session, name: string): Promise<Organization> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Organization name is required.');
  const slug = slugify(trimmed);

  const { data: orgRow, error: orgErr } = await supabase
    .from('organizations')
    .insert({ name: trimmed, slug, created_by: session.user.id })
    .select()
    .single();
  if (orgErr) throw orgErr;

  const { error: memErr } = await supabase
    .from('organization_members')
    .insert({
      organization_id: orgRow.id,
      user_id: session.user.id,
      org_role: 'owner',
    });
  if (memErr) {
    // The org row was created but the membership insert failed.
    // We can't easily roll the org back from the client (RLS would
    // bounce the delete since the user isn't yet a member). Surface
    // the error verbatim so the operator can recover; the followup
    // is to retry the membership insert from the dashboard.
    throw new Error(`Org created (id ${orgRow.id}) but owner membership insert failed: ${memErr.message}`);
  }

  return orgRow as Organization;
}

/** Redeem an invite code via the SECURITY DEFINER RPC. Returns the
 *  organization_id + role assigned. */
export async function acceptInvite(code: string): Promise<{ organization_id: string; org_role: 'owner' | 'admin' | 'member' }> {
  const { data, error } = await supabase.rpc('accept_invite', { invite_code: code.trim() });
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invite code not recognized.');
  }
  return data[0];
}

/** Generate a fresh invite code for an organization the caller
 *  administers. Returns the code string. */
export async function createInvite(
  organizationId: string,
  role: 'owner' | 'admin' | 'member' = 'member',
  ttlHours: number = 168,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_invite', {
    org_id: organizationId,
    role,
    ttl_hours: ttlHours,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('create_invite returned no code.');
  return data;
}
