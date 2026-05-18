# Project Rules

Read this file at the start of every session. These rules are not suggestions.

## Owner

Mohammad Esmaeil Shirmohammadi. Direct, results focused, expects work to be done right the first time.

## Tone in chat replies

- Direct and confident. No hedging, no apologies for normal work.
- Never use hyphens in prose.
- No corporate fluff. Just do the work and explain what you did.
- If something is a bad idea, say so plainly. Push back when you disagree.

## How to handle every request

Before writing any code, do this in order:

1. Restate the request in one sentence so we agree on the task.
2. List the acceptance criteria explicitly. What does "done" look like.
3. Plan the changes at a file level. What files will change, what stays untouched.
4. Confirm before non trivial work. If the task touches more than 3 files, modifies auth, deletes anything, changes data models, or affects external integrations, stop and confirm the plan first.
5. Implement only what was asked. No scope creep.

## Autonomy mode

Default behavior: run autonomously through assigned tasks without asking for plan approval. Do not pause for permission unless one of the trigger conditions below fires.

For every task:
1. Restate the request in one sentence.
2. List the acceptance criteria.
3. State the plan at a file level (what will change, what stays untouched).
4. Implement. Do not wait for approval on the plan unless a trigger fires.
5. Run the full review loop (task-verifier → code-reviewer → security-reviewer if applicable → npm run build).
6. Address all CRITICAL and IMPORTANT findings before declaring done.
7. Commit with a clear message. Do not push.
8. Move to the next task in the batch if one was specified.

Pause and ask Mohammad ONLY when one of these triggers fires:
- The plan would touch more than 5 files OR modify the store schema OR change auth OR delete anything substantial.
- A reviewer returns SCOPE DRIFT or REWRITE.
- npm run build fails AND you cannot fix the failure cleanly within 2 attempts.
- A request is ambiguous in a way that has multiple defensible interpretations.
- You discover the task as written conflicts with shipped code or CLAUDE.md.

When you pause, post: a one line headline of why, what you've completed so far, and the specific question you need answered.

When you complete a batch of tasks, post a single end of batch summary covering each task: what shipped, what reviewers caught, what cleanup got deferred, and any followups worth filing.

## The review loop (mandatory)

You may not declare any task complete until you have run this sequence:

1. Invoke the task-verifier subagent on the changes. If INCOMPLETE or SCOPE DRIFT, fix and re run.
2. Invoke the code-reviewer subagent. Address every CRITICAL and IMPORTANT finding.
3. If the change touched auth, user input, external APIs, database queries, file handling, or secrets, invoke the security-reviewer subagent. Address every CRITICAL and HIGH finding.
4. Run the project's tests and typecheck. Do not report done with red tests.

After all four pass, summarize: what was built, what reviewers caught, MINOR findings left for later, anything you noticed but did not touch.

## What you may not do without explicit permission

- Install new dependencies
- Modify package.json, tsconfig, .env, or CI configs beyond what the task requires
- Delete files or large blocks of working code
- Rewrite files that were not part of the request
- Commit, push, or force push
- Run destructive commands (rm, drop, truncate)

## When you get stuck

- Ambiguous request: ask one specific clarifying question. Do not guess.
- Tried twice and not working: stop, report what you tried.
- Test fails and you cannot tell why: report it, do not silently disable.

## Stack and conventions

Single page React app. No backend. State persists to localStorage via a versioned Zustand store.

- Runtime: React 18.3 + React Router 7 (~40 routes, one per screen).
- Build: Vite 6 + `@vitejs/plugin-react` (this is what runs the TypeScript type check; there is no standalone `tsc` script). Output goes to `dist/`.
- Language: TypeScript / TSX. No project-wide `tsconfig.json` at the repo root; the Vite plugin handles transpile + type errors at build time.
- Styling: Tailwind v4 via `@tailwindcss/vite`, plus design tokens in `src/styles/theme.css` (Light Drafting / Slate Engineering / Dark Command themes via `<html data-theme>`).
- UI primitives: Radix UI (`@radix-ui/react-*`), Lucide icons, sonner toasts, MUI for a few isolated surfaces.
- Store: one Zustand store under persist key `deeperVisionStore` (currently v8). Schema lives in `src/app/store/types.ts`; all entities (devices, doors, pathways, IDFs, attachments, work orders, pricebook, snapshots) hang off it.
- Routing: `BrowserRouter` in `src/app/App.tsx`. Canvas is the heart: `/project/:projectId/canvas` (`src/app/screens/EngineeringCanvas.tsx`, ~14k LOC).
- Layout rules on the canvas are non negotiable: tools on the left rail only, devices on the bottom bar only. Out of scope by default: Bus Designer, Threat Drill, Dashboard / CRM, Quote / Proposal builders, `deepervision-ai` (separate repo).
- Deploy: `vercel.json` is configured to ship the committed `dist/` directly (`buildCommand: "echo skip-build-using-prebuilt-dist"`). Every shipped change is a two commit ritual: source commit, then `git add dist && git commit -m "build: dist with <short-sha> stamp ..."`, then `npx vercel deploy --prod --yes`. The bundle carries `__COMMIT_HASH__` injected by `vite.config.ts` so the live URL can be diffed against the source SHA.
- Honesty rule: visible dead controls are forbidden. Anything not wired must be labelled (e.g. "Preview only · file persistence not wired") or hidden.
- Per pass acceptance criteria live in `docs/MVP_ACCEPTANCE_CHECKLIST.md`; manual walkthrough QA lives in `QA_CHECKLIST.md`. Extend the existing sections rather than starting parallel audit docs.

## Commands to run before declaring done

There is no `test`, `lint`, or `typecheck` script. The single check is the build, which type checks via `@vitejs/plugin-react`.

```bash
npm run build          # type check + production build to dist/. Must exit 0.
```

For changes the user can see in the browser, also do a fresh load pass:

```bash
npm run dev            # vite dev server on port 5173
# Open http://localhost:5173/project/p1/canvas after a localStorage.clear()
# Verify the specific flow the change covers + scan the console for new
# React or runtime errors (the standing Vite HMR websocket warning is cosmetic).
```

Deploy ritual when a pass is approved for shipping (the user must say so explicitly):

```bash
git commit -m "<source change>"                                # 1. source commit
npm run build                                                  # 2. produce new dist/
git add dist && git commit -m "build: dist with <sha> stamp"   # 3. dist commit
npx vercel deploy --prod --yes                                 # 4. ship
# Confirm: curl -sI https://deeper-vision-ashy.vercel.app/project/p1/canvas
# and grep the live bundle for the new source SHA stamp.
```

## Files and folders you should never modify without explicit instruction

- `dist/` — built artefacts. Only ever written by `npm run build` as part of the two commit deploy ritual. Never hand edit.
- `vercel.json` — the `skip-build-using-prebuilt-dist` trick depends on it. Changing it changes how every deploy works.
- `vite.config.ts` — owns build metadata injection (`__APP_VERSION__`, `__COMMIT_HASH__`, `__BUILD_TIME__`), the Figma asset resolver, and the assetsInclude allowlist. Touch only when the task is specifically about build config.
- `package.json` / `package-lock.json` — no new dependencies, no version bumps, no script changes without permission.
- `.mcp.json` — local MCP config, never committed (standing rule).
- `.claude/` — local Claude Code settings + the new subagent definitions; gitignored except where explicitly added.
- Out of scope screens (do not edit unless the task names them):
  - `src/app/screens/BusDesigner.tsx`, `src/app/screens/BusFleet.tsx`
  - `src/app/screens/ThreatDrillEditor.tsx`, `src/app/screens/ThreatDrillLibrary.tsx`
  - `src/app/screens/Dashboard.tsx`, `src/app/screens/PipelineView.tsx`, `src/app/screens/AccountDetail.tsx`
  - `src/app/screens/ProposalBuilder.tsx`
- Root level audit / handoff docs are reference material, not casual edit targets:
  - `AUDIT.md`, `CANVAS_AUDIT.md`, `SURVEYOR_*.md`, `FINAL_*.md`, `DEEPER_VISION_*.md`
  - Append to `QA_CHECKLIST.md` per pass; don't rewrite earlier sections.
- `node_modules/`, `.git/`, `.vercel/` — obvious.
