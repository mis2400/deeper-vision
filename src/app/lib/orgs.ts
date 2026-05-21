// Organization data access — Backend Phase 1A.
//
// Thin wrappers around the Supabase calls the org gate + auth gate
// need. Every call returns a typed result; errors are passed through
// verbatim so the UI can surface them honestly.

import { supabase } from './supabaseClient';

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

/** Create a new organization with the calling user as the owner.
 *  Delegates to the `create_organization_with_owner` SECURITY DEFINER
 *  RPC which performs both inserts (org + owner membership) inside
 *  one DB transaction. A failure rolls everything back — no orphan
 *  org rows are possible from the client side. */
export async function createOrganization(name: string): Promise<Organization> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Organization name is required.');

  const { data, error } = await supabase.rpc('create_organization_with_owner', {
    org_name: trimmed,
  });
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('create_organization_with_owner returned no row.');
  }
  // The RPC returns id, name, slug. created_at / created_by aren't
  // surfaced — fetch the full row so the caller has the same shape
  // a direct insert would have returned.
  const { id } = data[0];
  const { data: full, error: fullErr } = await supabase
    .from('organizations')
    .select('id, name, slug, created_at, created_by')
    .eq('id', id)
    .single();
  if (fullErr) throw fullErr;
  return full as Organization;
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
