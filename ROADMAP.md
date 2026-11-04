# JEVIL — Roadmap

> **Status:** planning · v0.1 · 2026-11-01
> **Read first:** [SPEC.md](./SPEC.md) · [App format](./docs/APP-FORMAT.md) · [Design system](./docs/DESIGN.md) · [Agent guide](./AGENTS.md)

This roadmap is sequenced so every phase ends with something demoable. Agents should pick the **first unchecked task in the current phase**, keep the phase's exit criteria in view, and update this file when scope changes.

```
Phase 0  Foundations        ──►  deployable shell, auth, tokens, CI
Phase 1  Connections        ──►  five adapters, encrypted keys, guest mode, test bench
Phase 2  Runtime + seeds    ──►  blueprint interpreter, renderer, 3 seed apps
Phase 3  Editor             ──►  drag-and-drop, bindings, live test, autosave
Phase 4  Marketplace        ──►  publish, versions, browse, fork, likes, reports
Phase 5  Hardening + beta   ──►  a11y, perf, abuse controls, launch
Later    Escape hatches     ──►  JS actions, media inputs, payments, i18n
```

**Critical path:** 0 → 1 → 2 → 3 → 4 → 5. The editor (3) can start once the blueprint schema and renderer (2) are stable; marketplace (4) can start once publish/version writes exist (early 3).

---

## Phase 0 — Foundations

**Goal:** a deployable SvelteKit app on Cloudflare with auth, D1, design tokens, and CI. No model calls yet.

### Tasks

- [x] Scaffold SvelteKit 3 + Svelte 5 + TypeScript strict with Bun.
  - `bunx sv create . --template minimal --types ts`
  - Add `adapter-cloudflare`, `wrangler.jsonc`, `.env.example`.
  - Verify `bun run dev`, `bun run build`, `bunx wrangler deploy --dry-run`.
- [x] Add Tailwind CSS v4 via `@tailwindcss/vite`; create `src/app.css` with `@import "tailwindcss"` and the `@theme` tokens from [DESIGN.md](./docs/DESIGN.md).
- [x] Add Fontsource packages: Bricolage Grotesque, Instrument Sans, JetBrains Mono. Subset Latin. Verify no FOUT-driven layout shift.
- [x] Create D1 database; add `DB` binding; wire Drizzle + drizzle-kit; commit the first migration. Local D1 works; the remote id is still a placeholder.
- [x] Add Better Auth with the Drizzle adapter:
  - [x] Email + password.
  - [x] Google OAuth (configured; needs real credentials to test).
  - [x] GitHub OAuth (configured; needs real credentials to test).
  - [x] Session cookie hardening (`HttpOnly`, `Secure`, `SameSite=Lax`).
  - [x] Email verification + password reset (Resend in prod, console in dev).
- [x] Generate auth tables via `bunx @better-auth/cli generate`; add `profile` table with handle/role.
- [x] Build the app shell: header, footer, skip link, theme tokens, focus styles, 404/500 pages.
- [x] Add light / dark / system themes with a persisted choice, no-flash boot script, and a header toggle. Palette follows JEVIL's purple, green, and gold.
- [x] Build the home page skeleton (hero, featured placeholder, how-it-works) and the catalog empty state.
- [x] Add `src/lib/schema/` with shared Zod primitives (slug, handle, provider ids). Connection input arrives with Phase 1.
- [x] Add `src/lib/server/redact.ts` and a structured logger that drops `authorization`, `cookie`, `x-jevil-key`, and any `secret` field.
- [x] CI: `bun install --frozen-lockfile`, `bun run check`, `bun run test`, `bun run build`, `wrangler deploy --dry-run`.
- [x] Add `AGENTS.md` conventions check (commit format, Bun-only, migrations forward-only).

### Exit criteria

- Production URL serves the home page and sign-in.
- Email/password + Google + GitHub sign-in work end-to-end in a preview deploy.
- A protected `/me` route redirects anonymous users to `/sign-in`.
- D1 migration applies cleanly from zero.
- CI is green on a fresh clone.
- Lighthouse on `/`: performance ≥90, accessibility ≥95.

### Demo script

Sign up with GitHub → land on `/me` → sign out → sign in with email → reset password → see the branded 404.

### Risks

- Better Auth + D1 adapter friction. Mitigation: validate the Drizzle adapter in a spike before building UI around it.
- Fontsource bundle size. Mitigation: subset + preload only the display face.

---

## Phase 1 — Connections and the decide core

**Goal:** connect Jev, Laya, Clef, Cloudflare Workers AI, and a local endpoint; call `decide`; normalize answers. This is the product's engine room.

### Tasks

- [x] Define the normalized `DecideRequest` / `DecideResponse` / `Answer` types in `src/lib/decide/types.ts`.
- [x] Implement `src/lib/server/providers/`:
  - [x] `base.ts` — `fetchJson` (15 s timeout, 256 KB cap, no redirects, redacted errors), `normalizeAnswers`, `ProviderError`.
  - [x] `jev.ts` — `POST /api/v1/decide`, `Bearer jv_live_`.
  - [x] `laya.ts` — `POST /v1/decide`, `Bearer laya_`; models `convaiinnovations/laya`, `…/laya-multilingual`.
  - [x] `clef.ts` — `POST /v1/clef-omni/run/`, `Bearer sk_live_`; models `clef-omni`, `clef`, `clef-flash`.
  - [x] `cloudflare.ts` — `POST /client/v4/accounts/{accountId}/ai/run/@cf/cloudflare/clef`, `Bearer <CF token>`.
  - [x] `systemone.ts` — custom base URL, optional bearer/custom header, `/v1/decide`.
  - [x] `index.ts` — registry + capability metadata.
- [x] Implement connection encryption:
  - [x] AES-256-GCM with WebCrypto; AAD binding to user/connection/provider/key version.
  - [x] `ENCRYPTION_KEY` + rotation map.
  - [x] Round-trip tests; tamper tests; wrong-AAD tests.
- [x] Connection CRUD API + settings UI:
  - [x] `GET/POST /api/connections`, `PATCH/DELETE /api/connections/:id`.
  - [x] `POST /api/connections/:id/test` (health/validation call).
  - [x] Provider picker with prefilled base URLs, model selector, "test" button, status badge.
  - [x] Never render the secret after save; show `•••• last4`.
- [x] Guest connections:
  - [x] IndexedDB store (`idb-keyval` or a tiny wrapper) with versioned schema.
  - [x] `POST /api/proxy/decide` with ephemeral `X-Jevil-Provider` / `Base-Url` / `Model` / `Key` / `Account-Id` headers.
  - [x] No DB write, no body logging, `Cache-Control: no-store`.
  - [x] Migration prompt on sign-in: import guest connections into encrypted account connections.
- [x] Local endpoint mode:
  - [x] Detect `localhost` / `127.0.0.1` / `[::1]`; route direct from the browser.
  - [x] CORS help panel with a copy-paste `Access-Control-Allow-Origin` snippet and `curl /health` check.
  - [x] Clear failure state when CORS blocks the request.
- [x] SSRF guard for custom/proxy endpoints: scheme, host, private ranges, redirects, ports.
- [x] Rate limiting:
  - [x] `RATE_LIMITER` binding per IP/user/connection.
  - [x] `usage_daily` counters for runs and tokens.
  - [x] 429 responses with `Retry-After`.
- [x] A developer "Decide bench" page (`/settings/connections/:id/test` or a modal): state textarea, three question builders, normalized JSON, latency, tokens.
- [x] Reference local bridge in `examples/laya-local-bridge/` (FastAPI or Flask) implementing the System One HTTP contract, with CORS and `/health`.
- [x] Contract tests with fixtures for all five adapters; error-mapping table tests. Fixtures are contract-shaped until real captures are available.

### Exit criteria

- A signed-in user can add, test, edit, and delete all five connection types.
- An anonymous user can add a guest cloud key and a local endpoint; both survive a reload.
- The decide bench returns normalized answers from Jev, Laya, Clef, Cloudflare, and a local Laya bridge.
- No plaintext key is present in D1, client state after save, logs, or error payloads (tests prove it).
- SSRF tests reject private hosts, redirects, and non-HTTPS production URLs.
- Rate limits return 429 with `Retry-After`.

### Demo script

Connect Jev with a real key → test → connect a local Laya bridge → run the same three questions against both → show normalized JSON side by side.

### Risks

- Unofficial hosts may change shape. Mitigation: adapters are isolated; contract fixtures; custom base URL always available.
- CORS on local endpoints. Mitigation: direct mode + explicit help + tunnel fallback.
- Workers cannot reach the user's localhost. Mitigation: documented direct mode; never promise proxy for local.

---

## Phase 2 — Blueprint runtime and seed apps

**Goal:** run declarative apps end-to-end, with a trusted renderer and three seed apps. No editor yet; blueprints are hand-authored JSON.

### Tasks

- [x] Implement `jevil/app@1` Zod schema exactly as specified in [APP-FORMAT.md](./docs/APP-FORMAT.md):
  - [x] `meta`, `inputs`, `steps`, `vars`, `ui`, `actions`.
  - [x] Semantic validation: unique IDs, valid bindings, question references, criteria sizes, state length, node count.
  - [x] Human-readable validation errors with JSON pointers.
- [x] Build the expression/binding engine:
  - [x] `{ lit }`, `{ var }`, `{ template }`, `{ step, question }`.
  - [x] Transforms: `lerp`, `clamp`, `round`, `lookup`, `mapRange`, `default`, `concat`.
  - [x] Builtins: `palette`, `hsl`, `contrastText`, `formatNumber`, `pick` (seeded).
  - [x] Cycle detection + missing-value fallbacks.
- [ ] Build the runtime:
  - [ ] Scope initialization (inputs, answers, vars).
  - [ ] Ordered decide steps with abort/timeout and per-step error states.
  - [ ] Lazy derived vars with topological ordering.
  - [ ] Run state machine: `idle → running → success | error`; cancel.
  - [ ] Deterministic seeded randomness from input hash.
- [ ] Build the component renderer (`src/lib/runtime/components/`):
  - [ ] Layout: `Stack`, `Grid`, `Card`, `Spacer`, `Divider`.
  - [ ] Input: `TextInput`, `TextArea`, `Select`, `Slider`, `Toggle`, `ColorInput`.
  - [ ] Display: `Heading`, `Text`, `Badge`, `Stat`, `Meter`, `ScoreDial`, `ProbabilityBars`, `Palette`, `Canvas`, `Shape`, `List`.
  - [ ] Action: `Button`, `IconButton`.
  - [ ] Feedback: `Skeleton`, `EmptyState`, `ErrorNote`, `ConfidenceChip`.
  - [ ] All text rendered as text; no `{@html}`; URL props validated.
- [ ] Implement the `Canvas` paint presets:
  - [ ] `palette-field` — soft blobs/gradient mesh from colors + energy.
  - [ ] `stripes` — poster bands.
  - [ ] `grain` — noise overlay.
  - [ ] `orb` — single gradient orb.
  - [ ] Deterministic by seed; reduced-motion static fallback.
- [ ] Build the app detail page + runner shell:
  - [ ] Server-rendered metadata and preview.
  - [ ] Client runner with connection picker, inputs, run, result, "How this was decided".
  - [ ] Pending/error/empty states.
- [ ] Author three seed blueprints in `src/lib/templates/`:
  - [ ] **Palette Oracle** — text → choice + 3 scores → 5-color palette + canvas + dials.
  - [ ] **Vibe Check** — textarea → 3 scores → verdict badge + dials + probability bars.
  - [ ] **Cover Maker** — title → genre choice + 2 scores → typographic cover on canvas.
- [ ] Add a read-only JSON viewer for seed apps (`/apps/[slug]/source`) to make the format legible.
- [ ] Runtime tests: schema fixtures, binding resolver, transform math, palette generation, step error handling, determinism.

### Exit criteria

- All three seed apps run against Jev, Laya, Clef, and a local endpoint with no code changes.
- The same inputs + answers produce the same visual output (snapshot tests).
- A malformed blueprint is rejected with a readable error, not a crash.
- Runner works at 390 px and 1280 px; keyboard-only run path works.
- The "How this was decided" panel shows per-question probabilities and confidence.
- Initial runner chunk ≤90 KB gzip.

### Demo script

Open Palette Oracle → run with "petrichor" → show palette, canvas, dials, probabilities → switch to Laya → run again → same layout, different decisions.

### Risks

- Palette math can look muddy. Mitigation: constrain hue/saturation/lightness ranges; curate harmony presets; visual review each seed app.
- Canvas performance on low-end phones. Mitigation: cap DPR at 2, static fallback, no per-frame animation.

---

## Phase 3 — No-code editor

**Goal:** a maker can build, test, and publish Palette Oracle from scratch without touching JSON.

### Tasks

- [ ] Editor route `/edit/[id]` with three panes + test bench (see SPEC §12).
- [ ] Draft persistence:
  - [ ] `POST /api/apps` create draft.
  - [ ] `PATCH /api/apps/:id` with `draft_revision` optimistic concurrency.
  - [ ] Autosave debounce 800 ms; "saved" / "conflict" states.
- [ ] Component palette:
  - [ ] Grouped, searchable, drag source.
  - [ ] Drag into containers with drop indicators.
  - [ ] Click-to-add fallback and keyboard move (`Alt+↑/↓`).
- [ ] Canvas:
  - [ ] Dotted grid, responsive width presets (mobile/tablet/desktop), zoom.
  - [ ] Selection outline, hover outline, breadcrumb for nested nodes.
  - [ ] Delete/duplicate/wrap actions.
- [ ] Inspector:
  - [ ] Typed prop controls per component.
  - [ ] Literal vs bound toggle; binding picker grouped by inputs / vars / step answers.
  - [ ] Inline validation (type mismatch, missing reference).
- [ ] Variables panel:
  - [ ] Inputs CRUD (id, label, type, default, required, max).
  - [ ] Derived vars CRUD with transform pipeline builder.
  - [ ] Answer references shown read-only with type and sample value.
- [ ] Questions panel:
  - [ ] Add/edit/delete `choice`, `score`, `noul`.
  - [ ] Criteria editor with reorder, min/max counts, duplicate-key checks.
  - [ ] State template editor with variable autocomplete.
- [ ] Test bench:
  - [ ] Inputs, run, normalized answers, raw JSON toggle, latency, tokens.
  - [ ] Per-step status and error.
  - [ ] "Use these answers as sample" for preview without a model call.
- [ ] Validation panel:
  - [ ] Schema errors, unresolved bindings, empty criteria, duplicate IDs, contrast warnings, size limits.
  - [ ] Click an error to focus the offending node.
- [ ] Undo/redo (100 entries), `Cmd/Ctrl+K` command palette, `Cmd/Ctrl+S` save.
- [ ] "Edit JSON" advanced mode with schema validation and format.
- [ ] Templates gallery: blank, Palette Oracle, Vibe Check, Cover Maker, Triage.
- [ ] Publish flow:
  - [ ] Metadata form (title, tagline, description, tags, accent, icon, remixable).
  - [ ] Validation gate, changelog, version creation.
  - [ ] Success sheet with public URL.
- [ ] Editor E2E: build Palette Oracle from blank and publish.

### Exit criteria

- A new user can build Palette Oracle from blank in under 10 minutes (timed usability test).
- Drag/drop, reorder, delete, undo/redo, autosave, and conflict recovery work.
- The binding picker prevents type errors before publish.
- Validation blocks publish on schema errors and unresolved bindings.
- Publish creates version 1 and the public page runs it.
- Editor chunk ≤160 KB gzip; no editor code in the catalog bundle.

### Demo script

`/new` → blank → add input "word" → add decide step with 4 questions → derive colors → add canvas + palette → test with a real key → publish → open the public URL → run.

### Risks

- Drag-and-drop complexity. Mitigation: use a small, well-tested library (e.g. `svelte-dnd-action`) behind an abstraction; keep keyboard fallback.
- Inspector state explosion. Mitigation: one reducer/store for editor state; undo via snapshots, not command replay.

---

## Phase 4 — Marketplace

**Goal:** the public loop: browse → run → remix → publish → report.

### Tasks

- [ ] Catalog API:
  - [ ] `GET /api/apps` with cursor pagination, sort, tag/capability filters, search.
  - [ ] FTS5 `app_search` sync on publish/unpublish/rename.
  - [ ] Denormalized counters with `ctx.waitUntil()`.
- [ ] Catalog UI:
  - [ ] Bento-ish featured grid with varied card sizes (not a uniform 3×N grid).
  - [ ] Search field with debounce, tag chips, sort control, empty state.
  - [ ] App cards with generated preview, author, runs, tags.
- [ ] App detail:
  - [ ] Hero, live preview, "How it decides", version history, remix lineage.
  - [ ] Like button (optimistic), run count, report link.
  - [ ] SEO: title, description, OG tags, canonical.
- [ ] Publish/version APIs:
  - [ ] `POST /api/apps/:id/publish` (batch: version + app + tags + FTS).
  - [ ] `GET /api/apps/:id/versions`, `GET /api/apps/:id/versions/:version`.
  - [ ] Unpublish / re-publish.
- [ ] Remix:
  - [ ] `POST /api/apps/:id/fork` creates a draft with attribution.
  - [ ] Detail page "Remixed from" link; profile "Remixes" tab.
  - [ ] Respect "no remix" flag.
- [ ] Likes and counters:
  - [ ] `POST/DELETE /api/apps/:id/like`, unique constraint, optimistic UI.
- [ ] Reports and moderation:
  - [ ] `POST /api/apps/:id/report` with reason + note.
  - [ ] Auto-unlist at 3 independent open reports.
  - [ ] `/admin` queue: view, hide, unlist, block, dismiss; audit log.
  - [ ] Author suspension.
- [ ] Profiles:
  - [ ] `/u/[handle]` with published apps, joined date, remix lineage.
  - [ ] `/me` with drafts, published, likes.
  - [ ] Handle selection + uniqueness + reserved names.
- [ ] Share:
  - [ ] Copy link, share sheet, "Remix this" CTA.
  - [ ] Static OG card fallback.
- [ ] Analytics:
  - [ ] `app_run` events, aggregate dashboards, 30-day prune scheduled Worker.
- [ ] E2E: guest run → sign up → publish → second user forks → report → admin resolves.

### Exit criteria

- A published app is discoverable via search, tag, and featured.
- A second user can run it with their own connection, like it, and fork it.
- Version history is immutable and visible.
- Reporting and moderation work; audit log records every action.
- Counters are accurate within one minute of the action.
- Catalog Lighthouse performance ≥90, accessibility ≥95.

### Demo script

Publish Palette Oracle → search "palette" → open from a private window → run as guest → sign in → remix → change one question → publish as "Palette Oracle II" → report the original → resolve in admin.

### Risks

- FTS5 availability/behavior in D1. Mitigation: feature-flagged `LIKE` fallback.
- Counter drift. Mitigation: nightly reconciliation query; counters are display-only, never billing.

---

## Phase 5 — Hardening and public beta

**Goal:** safe, fast, accessible, observable, and ready for strangers.

### Tasks

- [ ] Security review:
  - [ ] CSP headers on every route; no inline script; nonce/hash plan for Svelte.
  - [ ] SSRF table tests; DNS/private-range behavior documented.
  - [ ] Key redaction tests; grep the bundle for `jv_live_`, `laya_`, `sk_live_`, `ENCRYPTION_KEY`.
  - [ ] Auth: session revocation, OAuth state/PKCE, rate-limited sign-in, password reset token expiry.
  - [ ] Report/moderation abuse paths.
- [ ] Accessibility audit:
  - [ ] axe on `/`, `/apps`, detail, runner, editor, settings.
  - [ ] Keyboard-only pass through every flow.
  - [ ] Screen-reader pass (VoiceOver or NVDA) on runner + editor.
  - [ ] Reduced motion + high contrast.
- [ ] Performance:
  - [ ] Bundle analysis; enforce budgets in CI.
  - [ ] Font subsetting and preload.
  - [ ] D1 query review; add missing indexes; N+1 check.
  - [ ] Runner/editor route-level code splitting.
- [ ] Reliability:
  - [ ] Provider timeout/retry policy (no retry on auth/validation; one retry on network/5xx).
  - [ ] Error boundaries per route; graceful degradation when D1/provider is down.
  - [ ] Scheduled prune + counter reconciliation.
- [ ] Observability:
  - [ ] Dashboards: runs, success, p50/p95 latency by provider, tokens, reports.
  - [ ] Alerts: provider error rate, publish failure, D1 errors.
- [ ] Content:
  - [ ] 8–12 seed apps across categories (color, writing, decision, poster, sound-ish).
  - [ ] About, privacy, terms, "how decision models work" explainer.
  - [ ] Empty states, error copy, onboarding.
- [ ] Launch ops:
  - [ ] Custom domain, TLS, redirects.
  - [ ] Backups/export for D1 (scheduled `wrangler d1 export`).
  - [ ] Runbook: rotate keys, rotate encryption key, roll back deploy, handle abuse.
- [ ] Beta gate:
  - [ ] Invite 20 external users; collect friction notes.
  - [ ] Fix P0/P1 issues; publish a known-issues page.

### Exit criteria

- No P0/P1 security findings.
- axe clean; keyboard and screen-reader passes recorded.
- Budgets met on a mid-tier Android device.
- Alerts fire in a staged failure drill.
- 20 beta users complete "run an app" and 5 complete "publish an app" without help.
- Runbook reviewed and stored in `docs/RUNBOOK.md` (created in this phase).

### Demo script

A stranger opens the link, runs an app with a local model, publishes a remix, and reports a broken app — all without a guide.

---

## Later — escape hatches and expansion

Only after v1 is stable. Each item needs its own spec addendum and, for code execution, a security review.

| Item | Why | Guardrails |
| --- | --- | --- |
| **JS actions** (`sandbox@1`) | Apps that need real computation, not just bindings | Sandboxed iframe/Worker, no network/DOM/storage, typed bridge, review badge |
| **Media inputs** | Clef's differentiator: image/audio/video → decisions | Size caps, data URLs only, no remote fetch, cost warnings, capability filters |
| **Paid apps** | Sustain makers | Stripe Connect, tax, refunds, fraud; do not ship without legal review |
| **Comments / collections** | Discovery and curation | Moderation load, spam controls |
| **Team workspaces** | Agencies and classrooms | Roles, invites, shared connections (never share raw keys) |
| **i18n** | Laya's multilingual strength | Route-based locales, translated UI, RTL audit |
| **App analytics for makers** | "How is my app doing?" | Aggregate only, no inputs, opt-in |
| **Public API** | Let agents build/run apps | OAuth apps, scopes, rate limits, audit |
| **Cloudflare AI Gateway** | Caching, observability, BYOK routing | Optional; don't hide provider choice |

---

## Working agreement for agents

1. **Pick one phase.** Do not start Phase 4 UI while Phase 2 runtime is unstable.
2. **Keep the demo green.** Every merge should leave the current phase's demo script working.
3. **Update docs with schema changes.** [APP-FORMAT.md](./docs/APP-FORMAT.md) is normative; bump the version if you break it.
4. **Write the test before the fix** for security, normalization, and binding bugs.
5. **No new dependencies without a reason.** Prefer small, maintained, Workers-compatible packages.
6. **Bun only.** Do not introduce npm/pnpm/yarn lockfiles.
7. **Commit format is mandatory.** See [AGENTS.md](./AGENTS.md); the `LLM:` line is always line 2.
8. **Definition of done:** code + tests + docs + accessibility + no secrets + CI green.
