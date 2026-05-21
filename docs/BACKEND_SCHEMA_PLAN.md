# Backend schema plan — Phase 1A foundation + 1B migration target

This doc carries two jobs. Section 1 records what Phase 1A actually
builds today (auth + multi tenancy in Supabase). Section 2 maps every
existing Zustand store entity to its Phase 1B Postgres home so the
migration is a clean continuation, not a rewrite.

Read alongside the brief in chat. The honesty rule is non negotiable:
nothing in 1A is fake. Every signed in operator hits real Supabase
Auth; every organization row persists; RLS is the real boundary.

## 1. Phase 1A — what's live in Supabase today

Three tables in the `public` schema, all gated by RLS in BF1A.3.

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | One row per signed up `auth.users` row. Carries display name, avatar, and the operator type flag (`internal` vs `customer`). Auto created by a trigger on `auth.users` insert. | `id` (FK → auth.users), `display_name`, `email`, `avatar_url`, `user_type`, `created_at`, `updated_at` |
| `organizations` | Multi tenancy root. Each row is one tenant. | `id`, `name`, `slug`, `created_at`, `created_by` (FK → auth.users) |
| `organization_members` | User ↔ org junction carrying the operator's org level role. A user can belong to multiple orgs; each membership carries its own role. | `id`, `organization_id`, `user_id`, `org_role` (`owner`/`admin`/`member`), `created_at`, unique on `(organization_id, user_id)` |

### RLS posture in 1A

- `profiles`: read own + update own. No insert / delete from the
  client — the trigger handles insert and `auth.users` cascade
  handles delete.
- `organizations`: read when the requesting user is a member. Insert
  open to any authenticated user (creating an org), but the matching
  membership row inserted at the same time pins the creator as
  `owner`. Update / delete only by an owner of that org.
- `organization_members`: read rows for orgs the requesting user
  belongs to (so they can see their teammates and their own
  membership). Insert / update / delete restricted to owners and
  admins of the same org. A user inserting themselves as owner of a
  brand new org is allowed via a narrow policy that fires when the
  org row was just inserted and has no existing members.

## 2. Phase 1B — the migration target

Phase 1B moves every entity in the Zustand store at
`src/app/store/types.ts` into Postgres. Each table carries an
`organization_id` column with an RLS policy mirroring the org level
isolation already in place. The shape of each table follows the
existing TypeScript interface; only the persistence layer changes.

### Top level entities — all carry `organization_id`

| Zustand slice | Postgres table | RLS predicate |
|---|---|---|
| `customers` | `customers` | `organization_id ∈ user's orgs` |
| `contacts` | `contacts` | `organization_id ∈ user's orgs` |
| `projects` | `projects` | `organization_id ∈ user's orgs` AND optional per project membership (see project roles below) |
| `sites` | `sites` | scoped via parent `projects.organization_id` |
| `buildings` | `buildings` | scoped via parent `sites` → `projects` |
| `floors` | `floors` | scoped via parent `buildings` |
| `rooms` | `rooms` | scoped via parent `floors` |
| `devices` | `devices` | scoped via parent `floors` |
| `pathways` | `pathways` | scoped via parent `floors` |
| `idfs` | `idfs` | scoped via parent `floors` |
| `doors` | `doors` | scoped via parent `floors` |
| `attachments` | `attachments` | scoped via parent entity (device / pathway / floor / etc.) |
| `proposals` | `proposals` | scoped via parent `projects` |
| `approvals` | `approvals` | scoped via parent `proposals` |
| `estimates` | `estimates` | scoped via parent `projects` |
| `workOrders` (workOrderProgress) | `work_orders` | scoped via parent `projects` |
| `surveyItems` | `survey_items` | scoped via parent `projects` |
| `tasks` | `tasks` | `organization_id ∈ user's orgs` |
| `assets` | `assets` | scoped via parent `projects` |
| `warranties` | `warranties` | scoped via parent `assets` |
| `tickets` | `service_tickets` | scoped via parent `customers` |
| `ticketNotes` | `service_ticket_notes` | scoped via parent `service_tickets`. The `visibility` column (`internal` / `customer`) added in SC.7.7 stays; customer portal queries filter to `visibility = 'customer'`. |
| `activity` | `activity_events` | `organization_id ∈ user's orgs`, append only |
| `aiConversations` | `ai_conversations` + `ai_messages` (split for streaming) | `organization_id ∈ user's orgs`, scope further to per project context |
| `assistantContext` | NOT migrated — stays transient session state |
| `assistantPanelMode` | NOT migrated — stays transient session state |
| `userPrefs` | `user_preferences` | `user_id = auth.uid()`, no org scoping |
| `billing` | `billing_state` | one row per organization, owner only |
| `paymentMethod` | `payment_methods` | one row per organization, owner only |
| `invoices` | `invoices` | scoped via `organization_id`, owner / admin read |

### Per project collaboration roles — `project_members` (Phase 1B)

Per the CoWork spec, project level roles are finer than the org level
`owner` / `admin` / `member`. They will live on a `project_members`
table created in 1B:

| Role | What they can do |
|---|---|
| `project_admin` | Full Project Admin. Anything on the project. |
| `designer` | Designer. Edit anything on the canvas + the proposal. |
| `discipline_editor` | Discipline Editor. Edit devices / pathways of their declared discipline (camera / access / network / etc.) only. |
| `field_surveyor` | Field Surveyor. Edit survey items + commissioning on assigned devices; read everything. |
| `reviewer` | Reviewer. Read everything on the project + comment + approve / reject. |
| `customer_viewer` | Customer Viewer. Read the customer portal slice only. |
| `customer_collaborator` | Customer Collaborator. Customer Viewer + comment + e sign. |
| `read_only` | Read everything on the project. No mutations. |

Schema:

```sql
create type project_role as enum (
  'project_admin', 'designer', 'discipline_editor', 'field_surveyor',
  'reviewer', 'customer_viewer', 'customer_collaborator', 'read_only'
);

create table public.project_members (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  project_role    project_role not null,
  -- For discipline_editor the disciplines they're authorized for.
  -- Null for other roles.
  disciplines     text[],
  invited_by      uuid references auth.users,
  created_at      timestamptz not null default now(),
  unique (project_id, user_id)
);
```

RLS on every project scoped table reads from both
`organization_members` (org level) and `project_members` (project
level) so a user can be (a) an org `member` with no per project
grant and see nothing, or (b) a `customer_viewer` on one specific
project under a foreign org without inheriting org wide access.

### Non migrated state

These remain in localStorage because they're transient session UI
state that has no value being shared / persisted across clients:

- `selectedDeviceId`, `selectedPathwayId`, `selectedRoomId`
- `currentFloorIdByProject`
- `canvasUndoStack`, `canvasRedoStack`
- `editOpenForId`, `editTab`
- `assistantContext`, `assistantPanelMode`
- Layer visibility / display flags (`canvasLayers`, `canvasDisplay`)
- Snap, theme override, view mode

These will continue to use the existing Zustand `persist` middleware
(localStorage key `deeperVisionStore`, currently v31) even after 1B.
The store schema in 1B drops the migrated slices and keeps only the
transient ones.

## 3. Storage (Supabase Storage)

Phase 1B will move `attachments` to Supabase Storage with the
following bucket layout:

```
attachments/<organization_id>/<entity_kind>/<entity_id>/<attachment_id>.<ext>
```

RLS on the bucket mirrors the org / project predicates above.
Large image uploads no longer ship as base64 in the Zustand store.

## 4. Realtime (Phase 1B + later)

`devices`, `pathways`, `rooms`, `doors`, `floors`, and `service_ticket_notes`
get Realtime channels keyed by `project_id` so two operators on the
same canvas see each other's edits without a refresh. Liveblocks
sits on top for ephemeral cursor positions and presence (Phase 2).

## 5. Honest deferrals

- Email invitations (BF1A.5) start as invite codes the org owner
  shares directly. SMTP wired invites layer on once we pick a
  transactional email provider.
- Bulk import (CSV / Notion / Airtable) of existing customers and
  projects: a 1B job, after the schema lands and an operator has
  validated one or two manual migrations.
- Audit log on `organizations` / `organization_members` (who
  invited whom, when): deferred until we have a real reason — the
  `created_at` + `created_by` columns are enough for V1.
