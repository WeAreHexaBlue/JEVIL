# JEVIL — Product & Technical Specification

> **Status:** draft · v0.1 · 2026-11-01
> **Companion docs:** [Roadmap](./ROADMAP.md) · [App format](./docs/APP-FORMAT.md) · [Design system](./docs/DESIGN.md) · [Agent guide](./AGENTS.md)

JEVIL is a marketplace for small, playful apps powered by **decision models** instead of chat models. A user brings an API key (or a local endpoint), picks an app, and gets a designed visual result — a palette, a poster, a verdict, a meter — not a wall of generated text.

The product bet is simple: **the interesting part of an AI app is the interface and the decision, not the prose.** Decision models make that bet cheap, fast, and safe.

---

## 1. The models

Three model families share one primitive: **state in → typed questions → probabilities out**. None of them generate free-form text, so there is no JSON-in-a-string to parse and no hallucinated prose to render.

### 1.1 Jev (TypeSafe)

- **Owner:** TypeSafe AI. Closed API.
- **Category:** "System One" decision model.
- **Endpoint:** `POST https://api.typesafe.ai/v1/systemone`.
- **Auth:** `Authorization: Bearer <TypeSafe API key>`.
- **Body:** `{ model, state, questions }`
  - `state` — string, object, or array; 64k per-request context by default.
  - `questions` — map of `id → question`.
  - `model` — required. `jev-latest` (default alias), `jev-preview`, or a versioned ID such as `jev-1.14.0`.
- **Question types:**
  - `choice` — `criteria` is a map of option key → description. Returns the winning key, per-option probabilities, and confidence.
  - `score` — `criteria` is an ordered array of 2–10 levels. Returns a numeric score plus a distribution.
  - `noul` — calibrated yes/no. No criteria; returns a probability in `[0, 1]`.
  - `box` — beta bounding box; **out of scope for v1**.
- **Extras:** `GET /v1/models`, `TypeSafe-Danger-Zone-Long-Context` (262k context), and image `assets` / `box` questions behind `TypeSafe-Danger-Zone-Images`.
- **Response shape:**

```json
{
  "model": "jev-1.14.0",
  "answers": {
    "route": { "type": "choice", "choice": "billing", "confidence": 1.0, "probabilities": { "billing": 1.0, "bug": 0.0 } },
    "urgency": { "type": "score", "score": 2.0, "confidence": 0.9, "probabilities": { "0": 0.05, "1": 0.1, "2": 0.7, "3": 0.15 } },
    "escalate": { "type": "noul", "noul": 0.72 }
  },
  "usage": { "input_tokens": 180, "output_tokens": 0 }
}
```

- **Metering:** input tokens only; output is free. Rate limit ≈120 req/min per key.

### 1.2 Laya (Convai Innovations)

- **Owner:** Convai Innovations. **Apache 2.0 open weights.**
- **Local:** `pip install laya`; `Router(preload=True).predict(state, questions)`.
- **Hosted community gateway:** `POST https://laya-model.com/v1/decide` (aliases `/v1/systemone` and `/api/decide`), `Authorization: Bearer laya_…`
- **Models:** `english` (default) and `multilingual`. The gateway also accepts `laya`, `laya-multilingual`, and the underlying `convaiinnovations/laya*` ids.
- **Schema:** same `state` + `questions` shape as Jev (`choice`, `score`, `noul`); `model` is optional.
- **Response:** the upstream checkpoint id in `model` (for example `laya-0.3.4/english`), plus `usage`, `timing`, and gateway `billing`.
- **Why it matters:** self-hosting, no vendor lock-in, multilingual checkpoint, very low latency on modest hardware.
- **Local HTTP contract:** Laya ships as a Python library, not an HTTP server. JEVIL defines a tiny **System One HTTP contract** (see §10.4) so a local wrapper can serve the same schema to the browser.

### 1.3 Clef (Cloudflare)

- **Owner:** Cloudflare. **Apache 2.0.** 27B multimodal decision model (Clef Omni is a 30B MoE / ~3B active variant on the demo host); `clef-flash` is the 9B sibling.
- **Workers AI:** `@cf/cloudflare/clef` and `@cf/cloudflare/clef-flash`; 65,536-token context; vision. **$0.24 / M input tokens**, output free. The REST path carries the `@cf/...` id; the JSON body carries the short selector (`model: "clef" | "clef-flash"`). Responses arrive in Cloudflare's `{ success, result }` envelope.
- **Hosted community gateway:** `POST https://clefdemo.com/v1/clef-omni/run/`, `Authorization: Bearer sk_live_…`
- **Schema:** System One-compatible, plus optional `images[]`, `audio[]`, `videos[]` (embedded data URLs only).
- **Why it matters:** multimodal gates — a palette from a photo, a verdict from a screenshot, a mood from a clip. Media support is a later phase, but the schema must not block it.

> **Host caveat:** Jev ships against TypeSafe's official `api.typesafe.ai`. `laya-model.com` and `clefdemo.com` are independent community hosts, not the model owners. Every connection in JEVIL stores a **base URL**, so users can point at official endpoints, a proxy, or a local server without a code change.

### 1.4 The shared contract

```ts
type Question =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] } // 2–10 ordered levels
  | { type: "noul"; instructions: string };

type Answer =
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: "score"; score: number; confidence: number; probabilities: Record<string, number> }
  | { type: "noul"; noul: number };

interface DecideRequest {
  state: string | Record<string, unknown> | unknown[];
  questions: Record<string, Question>;
  model?: string;
}

interface DecideResponse {
  model: string;
  answers: Record<string, Answer>;
  usage?: { input_tokens?: number; billed_tokens?: number; output_tokens?: number };
  meta?: Record<string, unknown>;
}
```

**Normalization rule:** adapters must return `score` as a **0..1** value, derived from the probability distribution when available (`Σ i·pᵢ / (n−1)`), falling back to `raw_score / (n−1)`. Keep the raw provider payload in a non-persisted `_raw` field for debugging only.

---

## 2. Product principles

1. **The app is the interface, not a chat.** No message bubbles, no streaming prose, no "As an AI…". The result is a composed visual state.
2. **Probabilities are material.** Confidence is shown honestly — a chip, a dial, a distribution — never hidden behind a fake certainty.
3. **Small and remixable.** An app should be understandable in one screen and forkable in one click.
4. **Your key, your model.** BYO credentials, local endpoints, and guest mode are first-class. JEVIL never becomes a toll booth between the user and the model.
5. **Playful, not childish.** Expressive type, chunky shapes, springy motion; no mascots, no gradient soup, no emoji confetti.
6. **Safe by construction.** Published apps are declarative data, rendered by a trusted runtime. No arbitrary code in v1.

---

## 3. Users and jobs

| Persona | Job | Account? |
| --- | --- | --- |
| **Runner** | "Show me something small and delightful. I already have a key or a local model." | No |
| **Maker** | "I have an idea for a tiny app. Let me build it without code and publish it." | Yes |
| **Remixer** | "This app is close. Fork it, change the questions, make it mine." | Yes |
| **Operator** | "Keep the marketplace useful and safe." | Admin |

### Jobs to be done

- When I find an app, I want to run it immediately with my own connection, without signing up.
- When I build an app, I want to wire an input to a model question and see the result live.
- When I publish, I want a stable link, a version history, and attribution when someone remixes.
- When I browse, I want to understand what an app does from its preview, not from a paragraph of marketing.

---

## 4. Scope

### 4.1 In scope for v1 (public beta)

- Public catalog with search, tags, featured apps, and app detail pages.
- Runner with guest connections (browser-local keys and local endpoints) and account connections (encrypted server-side).
- Provider adapters: Jev, Laya hosted, Clef hosted, Cloudflare Workers AI, and any System One-compatible custom endpoint.
- Declarative app format v1, trusted Svelte renderer, expression/binding engine, and three seed apps.
- No-code editor: drag-and-drop canvas, component palette, inspector, variables/questions panels, live test bench, validation, undo/redo, autosave.
- Publish, immutable versions, fork/remix, likes, reports, basic moderation.
- Better Auth: email + password, Google, GitHub. Email verification required to publish.
- Design system, responsive layouts, dark-mode-ready tokens, accessibility baseline.

### 4.2 Explicit non-goals for v1

- Payments, paid apps, subscriptions, or revenue sharing.
- Comments, direct messages, follows, collections, or a social graph.
- Arbitrary JavaScript in published apps (reserved as a v2 escape hatch, see §16).
- Image/audio/video app inputs (Clef media) — schema-ready, UI later.
- Real-time collaboration, teams, private workspaces.
- Native mobile apps, offline mode, i18n.
- Model fine-tuning, prompt authoring, or free-form text generation.

---

## 5. Core concepts

| Concept | Definition |
| --- | --- |
| **Connection** | A provider + base URL + credential (or "none" for local). Belongs to a user, or lives only in the browser for guests. |
| **App** | A draft blueprint owned by a user, with metadata, a slug, and a visibility state. |
| **Blueprint** | The versioned JSON document that defines inputs, model steps, variables, and UI. See [APP-FORMAT.md](./docs/APP-FORMAT.md). |
| **Version** | An immutable snapshot of a blueprint, created on publish. |
| **Run** | One execution of a blueprint with a set of inputs and one connection. |
| **Remix / fork** | A copy of a published version into the current user's drafts, with attribution. |
| **Decision** | A typed answer from a model: `choice`, `score`, or `noul`. |
| **Binding** | A safe reference from a UI prop to an input, variable, or answer. |
| **Seed app** | A first-party app shipped with JEVIL to demonstrate the format. |

---

## 6. User journeys

### 6.1 Anonymous runner

1. Lands on `/`. Sees featured apps and a one-line explanation.
2. Opens `/apps/palette-oracle`. The app detail page shows a live preview and a **Run** button.
3. Clicks **Run**. A connection sheet asks for a provider, base URL (prefilled), and key — or a local endpoint.
4. The key is stored in **IndexedDB** on this device only. The runner calls the app.
5. Result appears with a confidence disclosure. No account, no email, no server-side key.
6. Optional: "Save this connection" prompts sign-in; signing in can migrate the guest connection into an encrypted account connection.

### 6.2 Maker

1. Signs in with GitHub/Google/email.
2. `/new` → chooses a blank canvas or a template.
3. Drags an **Input** onto the canvas, names it `word`.
4. Adds a **Decide** step, writes four questions, tests them in the bench.
5. Drags a **Canvas** and a **Palette**; binds their props to `steps.read.family.choice` and `vars.colors`.
6. Hits **Preview**, iterates, then **Publish**.
7. Publish runs validation, creates version `1`, and returns `/apps/palette-oracle`.

### 6.3 Remixer

1. Opens a published app → **Remix**.
2. A new draft is created with `remixed_from` attribution.
3. Edits, publishes as their own app. The detail page links back to the original.

### 6.4 Local model

1. User runs a Laya wrapper on `http://localhost:8787`.
2. In the connection sheet, chooses **Local / custom**, enters the URL.
3. JEVIL detects `localhost`/`127.0.0.1` and uses **direct browser mode** (the server cannot reach the user's machine).
4. The wrapper must allow CORS for the JEVIL origin. The sheet includes a copy-paste CORS snippet and a `curl` health check.
5. If direct mode fails, the user can expose the endpoint via a tunnel and use **proxy mode** instead.

---

## 7. Information architecture

| Route | Purpose | Auth |
| --- | --- | --- |
| `/` | Home: hero, featured apps, how it works | Public |
| `/apps` | Catalog with search, tags, sort | Public |
| `/apps/[slug]` | App detail, preview, run CTA, remix, report | Public |
| `/apps/[slug]/run` | Focused runner (also embedded on detail) | Public |
| `/new` | Create draft from blank/template | User |
| `/edit/[id]` | No-code editor | Owner |
| `/u/[handle]` | Maker profile and published apps | Public |
| `/me` | My apps, drafts, likes | User |
| `/settings/connections` | Manage account connections | User |
| `/settings/account` | Profile, handle, email, sessions | User |
| `/sign-in`, `/sign-up`, `/verify`, `/reset` | Auth flows | Public |
| `/admin` | Reports, hide/unlist, feature apps | Moderator |
| `/about`, `/privacy`, `/terms` | Static pages | Public |

**URL rules:** app slugs are lowercase kebab-case, 3–48 chars, unique, immutable after first publish (redirects on rename). Handles are 3–24 chars, unique, case-insensitive.

---

## 8. Technical architecture

### 8.1 Stack

| Layer | Choice |
| --- | --- |
| Framework | SvelteKit 3 + Svelte 5 (runes), TypeScript strict |
| Styling | Tailwind CSS v4 (CSS-first `@theme` tokens) |
| Runtime (prod) | Cloudflare Workers (`adapter-cloudflare`, `workerd`) |
| Runtime (dev/scripts) | Bun |
| Package manager | Bun (`bun install`, `bun run`, `bun test`) |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM / drizzle-kit |
| Auth | Better Auth (email + password, Google, GitHub) with Drizzle adapter |
| Files | R2 only when uploads land (v1 icons are generated, no uploads) |
| Email | Resend HTTP API (verification, password reset); console fallback in dev |
| Validation | Zod schemas shared between server and client |
| Testing | Vitest, Testing Library, Playwright, axe |
| Deploy | Wrangler + GitHub Actions |

**Bun vs Workers:** Bun is the local package manager, script runner, and test runner. Production code runs on `workerd`. Do not depend on Bun-only APIs (`Bun.file`, `Bun.sql`, etc.) in `src/`. Use Web APIs and `platform.env`.

### 8.2 High-level shape

```
Browser
├── SvelteKit app (SSR + hydration)
│   ├── Catalog / detail / profile (server-rendered, cached)
│   ├── Runner (client runtime, lazy-loaded)
│   │   ├── Blueprint interpreter
│   │   ├── Binding/expression engine
│   │   └── Component renderer (trusted Svelte components)
│   └── Editor (client-heavy, lazy-loaded)
│       ├── Canvas / drag-drop
│       ├── Inspector + binding picker
│       └── Test bench
│
└── Model transport
    ├── Account connection → POST /api/decide (session cookie) → D1 decrypt → provider
    ├── Guest cloud key  → POST /api/proxy/decide (ephemeral header) → provider
    └── Local endpoint   → direct fetch from browser → http://localhost:PORT/v1/decide

Cloudflare Worker
├── SvelteKit server routes (+server.ts)
├── D1 (users, apps, versions, connections, likes, reports)
├── Rate limiting binding + daily counters
└── Secrets (auth, encryption, OAuth, Resend)
```

### 8.3 Request flow — a run

1. Runner validates inputs locally (Zod) and resolves the selected connection.
2. For each `decide` step, in order:
   - Build `state` from templates and variables.
   - Build `questions` from the blueprint.
   - Call the transport:
     - **Account:** `POST /api/decide` with `{ connectionId, state, questions, model }`. The server checks the session, decrypts the key, calls the provider, normalizes, and returns answers. The key never reaches the client.
     - **Guest cloud:** `POST /api/proxy/decide` with `X-Jevil-Provider`, `X-Jevil-Base-Url`, `X-Jevil-Model`, `X-Jevil-Key`, and, for Cloudflare, `X-Jevil-Account-Id`. The server validates the host, forwards, normalizes, and discards the key. No DB write, no logging.
     - **Local:** direct `fetch` to the user's endpoint. No JEVIL server involvement.
3. Store answers in the run scope. Compute derived variables.
4. Render the UI. Pending steps show skeletons; errors show an inline `ErrorNote` with retry.
5. Increment an aggregate run counter (no inputs, no state) and emit a metrics event.

### 8.4 SSR, caching, and bundles

- Catalog and app detail pages are server-rendered for SEO and fast first paint.
- Public app blueprints are immutable per version and cached with `ETag` + `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`.
- The runner and editor are lazy-loaded route chunks. The initial catalog JS budget is **≤180 KB gzip**.
- No model calls during SSR in v1. Dynamic OG images are a phase 5 nicety; use a static branded card until then.

### 8.5 Local development

```bash
bun install
bun run db:migrate:local     # wrangler d1 migrations apply --local
bun run dev                  # Vite + adapter-cloudflare platform proxy
bun run test                 # Vitest
bun run check                # svelte-check + tsc
bun run build && bunx wrangler deploy --dry-run
```

`.dev.vars` holds local secrets (gitignored). D1 local state lives under `.wrangler/`.

---

## 9. Data model

All IDs are `TEXT` (UUID v4). Timestamps are `INTEGER` Unix milliseconds. JSON is stored as `TEXT` and validated at the boundary. D1 is SQLite: use `json_extract` sparingly, keep hot filters in real columns.

### 9.1 Auth tables (Better Auth)

`user`, `session`, `account`, `verification` — generated by the Better Auth CLI. Do not hand-edit; regenerate with `bunx @better-auth/cli generate`.

### 9.2 App tables

| Table | Key columns |
| --- | --- |
| `profile` | `user_id` PK → user, `handle` UNIQUE, `display_name`, `bio`, `avatar_seed`, `role` (`user`/`moderator`/`admin`), `created_at` |
| `connection` | `id` PK, `user_id`, `provider` (`jev`/`laya`/`clef`/`cloudflare`/`systemone`), `label`, `base_url`, `model`, `config_json` (non-secret, e.g. CF account ID), `auth_scheme` (`bearer`/`header`/`none`), `secret_ct` TEXT (base64 ciphertext), `secret_iv` TEXT (base64), `key_version` INT, `secret_last4`, `status` (`unchecked`/`ok`/`error`), `last_checked_at`, `created_at`, `updated_at`; index (`user_id`, `provider`) |
| `app` | `id` PK, `owner_id`, `slug` UNIQUE, `title`, `tagline`, `description`, `icon`, `accent`, `tags_json`, `blueprint_json` (draft), `draft_revision` INT, `published_version_id`, `visibility` (`draft`/`unlisted`/`public`/`blocked`), `remixed_from_app_id`, `remixed_from_version_id`, `created_at`, `updated_at`, `published_at` |
| `app_version` | `id` PK, `app_id`, `version` INT, `blueprint_json`, `changelog`, `created_by`, `created_at`; UNIQUE (`app_id`, `version`) |
| `app_tag` | `app_id`, `tag`; PK (`app_id`, `tag`) |
| `app_like` | `app_id`, `user_id`, `created_at`; PK (`app_id`, `user_id`) |
| `app_run` | `id` PK, `app_id`, `version_id`, `user_id` NULL, `anon_id` NULL, `provider`, `status` (`ok`/`error`), `latency_ms`, `input_tokens`, `created_at` — **never stores inputs or state** |
| `app_report` | `id` PK, `app_id`, `reporter_id` NULL, `reason` (`spam`/`unsafe`/`broken`/`other`), `note`, `status` (`open`/`resolved`/`dismissed`), `created_at`, `resolved_at`, `resolved_by` |
| `usage_daily` | `subject` (user or IP hash), `day` (`YYYY-MM-DD`), `runs`, `tokens`; PK (`subject`, `day`) |
| `audit_log` | `id` PK, `actor_id`, `action`, `target_type`, `target_id`, `meta_json`, `created_at` |

### 9.3 Search

`app_search` is an FTS5 virtual table (`unicode61`) over `title`, `tagline`, `description`, `tags`, `author_handle`. Sync on publish, unpublish, and profile rename. Query with `bm25()` plus a recency boost. If FTS5 is unavailable in the target D1 region, fall back to `LIKE` with a feature flag.

### 9.4 Indexes

- `app(owner_id)`, `app(visibility, published_at DESC)`, `app(published_version_id)`
- `app_like(app_id)`, `app_run(app_id, created_at)`, `app_report(status, created_at)`
- `connection(user_id, provider)`, `app_version(app_id, version)`
- `usage_daily(day)`

### 9.5 D1 constraints to design around

- Keep statements under the bound-parameter limit; batch writes with `db.batch()`.
- No long-running transactions; publish writes are a single batch (`app` update + `app_version` insert + tag/search sync).
- D1 is not a queue. Use `ctx.waitUntil()` for analytics counters and search sync.
- Migrations are forward-only and committed under `drizzle/`.

---

## 10. Provider integration

### 10.1 Adapter interface

```ts
export interface DecideContext {
  connection: ResolvedConnection; // provider, baseUrl, model, config, secret
  signal: AbortSignal;
}

export interface DecideAdapter {
  id: ProviderId;
  defaultBaseUrl: string;
  capabilities: Array<"text" | "image" | "audio" | "video">;
  validate(connection: ResolvedConnection): Promise<ValidationResult>;
  decide(ctx: DecideContext, req: DecideRequest): Promise<DecideResponse>;
}
```

Adapters live in `src/lib/server/providers/`. They share a `normalizeAnswers()` helper and a `fetchJson()` helper with timeout (15 s), response-size cap (256 KB), and redacted errors.

### 10.2 Provider matrix

| Provider | `id` | Default base URL | Path | Auth | Models |
| --- | --- | --- | --- | --- | --- |
| Jev | `jev` | `https://api.typesafe.ai` | `/v1/systemone` | `Bearer <TypeSafe key>` | `jev-latest`, `jev-preview`, `jev-1.14.0`, `jev-1.13.0` |
| Laya (hosted) | `laya` | `https://laya-model.com` | `/v1/decide` | `Bearer laya_…` | `english`, `multilingual`, `laya`, `laya-multilingual` |
| Clef (hosted) | `clef` | `https://clefdemo.com` | `/v1/clef-omni/run/` | `Bearer sk_live_…` | `clef-omni`, `clef`, `clef-flash` |
| Cloudflare Workers AI | `cloudflare` | `https://api.cloudflare.com` | `/client/v4/accounts/{accountId}/ai/run/@cf/cloudflare/clef` | `Bearer <CF token>` | `@cf/cloudflare/clef`, `@cf/cloudflare/clef-flash` |
| Local / custom | `systemone` | user-supplied | `/v1/decide` | none / bearer / custom header | any |

`config_json` holds non-secret per-provider config: `{ accountId }` for Cloudflare, `{ headerName }` for custom auth. Secrets are never in `config_json`.

Cloudflare is the one adapter whose request and response differ structurally from the shared contract: the `@cf/...` model id belongs in the URL path, the body carries `model: "clef" | "clef-flash"`, and `fetchJson` output must be unwrapped from `{ success, result }` before `parseDecideResponse`. The adapter normalizes either spelling of the model id and rejects anything else.

### 10.3 Normalization

- `choice`: require `choice` ∈ criteria keys; clamp `confidence` to `[0,1]`; normalize `probabilities` to sum to 1 (tolerate missing options).
- `score`: derive `normalized = Σ i·pᵢ / (n−1)` when `probabilities` exist; otherwise `clamp(raw / (n−1), 0, 1)`. Return `level` (raw index) and `levels` (count) as extras for UI.
- `noul`: accept `noul` or `probability`; clamp to `[0,1]`.
- Unknown answer types are dropped with a warning, not thrown — one bad question must not kill the whole run.
- Provider errors map to `ProviderError` codes: `auth`, `rate_limit`, `quota`, `validation`, `timeout`, `network`, `upstream`, `unsupported`.

### 10.4 System One HTTP contract (local/custom)

Any endpoint that implements this is usable as a `systemone` connection:

```
GET  /health
     → 200 { "ok": true, "model": "laya", "capabilities": ["text"] }

POST /v1/decide
     Authorization: Bearer <optional>
     Content-Type: application/json
     { "state": string|object|array, "questions": { ... }, "model"?: string }
     → 200 { "model": string, "answers": { ... }, "usage"?: { ... } }

CORS: Access-Control-Allow-Origin: <JEVIL origin> (or *)
      Access-Control-Allow-Headers: authorization, content-type
      Access-Control-Allow-Methods: GET, POST, OPTIONS
```

A reference Flask bridge lives in `examples/laya-local-bridge/`. It implements the contract above, answers CORS for the configured JEVIL origin, and either forwards to Laya or answers deterministically so the UI can be exercised without a key.

### 10.5 Connection modes

| Mode | Stored where | Transport | Use case |
| --- | --- | --- | --- |
| **Account** | D1, AES-256-GCM encrypted | Server proxy | Signed-in makers and runners who want sync across devices |
| **Guest** | Browser IndexedDB | Server proxy with ephemeral key header | Anonymous runners with cloud keys |
| **Local** | Browser IndexedDB (URL only, optional token) | Direct browser fetch | `localhost` model servers; server cannot reach the user's machine |

**Migration:** when a guest signs in, offer to import guest connections into encrypted account connections. Delete the browser copy only after a successful save. Only hosted cloud keys migrate; local endpoints stay in the browser because the server cannot reach them.

### 10.6 Key encryption

- `ENCRYPTION_KEY` is a base64-encoded 32-byte key, stored as a Wrangler secret.
- AES-256-GCM, random 12-byte IV per encryption, AAD = `${userId}:${connectionId}:${provider}:${keyVersion}`.
- `ENCRYPTION_KEYS` (JSON map `version → base64 key`) supports rotation; new writes use the highest version.
- Decrypt only inside the decide request. Never return plaintext to the client. Never log headers, bodies, or error objects that may contain the key.
- Ciphertext and IV are stored as base64 `TEXT` so a D1 row round-trips without
  Node's `Buffer`; the AAD still binds each value to the row (SPEC §9.2).
- `secret_last4` is stored for UI display ("•••• 4f2a"). Do not store the full key anywhere else.

### 10.7 SSRF and endpoint safety

- Custom base URLs must be `https://` in production. `http://` is allowed only for `localhost`, `127.0.0.1`, and `[::1]` when `ALLOW_LOCAL_ENDPOINTS=true`.
- Reject credentials in URLs, fragments, non-standard ports outside an allowlist, and hostnames that resolve to private/link-local/metadata ranges. On Workers, literal IP and hostname allow/deny checks are the first line; do not follow redirects (`redirect: "manual"`).
- Cap response size at 256 KB and timeout at 15 s.
- Proxy mode never accepts a private/local host. Local endpoints use direct browser mode instead.

---

## 11. App format (summary)

A blueprint is a JSON document with `schema: "jevil/app@1"`. It contains:

- `meta` — title, tagline, description, tags, accent, icon, engine capabilities.
- `inputs` — typed user inputs (`text`, `textarea`, `select`, `slider`, `toggle`, `color`).
- `steps` — ordered `decide` steps (and, later, `transform`/`action` steps).
- `vars` — derived values computed from answers with a safe transform pipeline.
- `ui` — a tree of allowlisted components with bindings.
- `actions` — `run`, `reset`, `set`, `copy`, `open`.

The full schema, expression grammar, component catalog, runtime semantics, limits, and a complete Palette Oracle example live in **[docs/APP-FORMAT.md](./docs/APP-FORMAT.md)**. That file is normative; this section is only an orientation.

**Versioning:** `jevil/app@1` is the frozen major line. Additive, backward-compatible changes keep the same `schema` string and are gated by the runtime's build version; breaking changes bump to `jevil/app@2` and ship an editor migration. Published v1 apps keep running on the v1 runtime.

---

## 12. Editor

### 12.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back   Untitled app        [Preview] [Save] [Publish]     │
├──────────┬───────────────────────────────────┬───────────────┤
│ Palette  │            Canvas                 │  Inspector    │
│ Search   │  dotted grid, device widths       │  Props        │
│ Layout   │  selection outline + handles      │  Bindings     │
│ Input    │  drop indicators                  │  Style        │
│ Display  │                                   │               │
│ Model    │                                   │  Variables    │
│          │                                   │  Questions    │
├──────────┴───────────────────────────────────┴───────────────┤
│  Test bench: inputs · Run · answers · latency · tokens       │
└──────────────────────────────────────────────────────────────┘
```

### 12.2 Interactions

- Drag from the palette into a container; drop indicators show insertion points. Reorder by dragging; keyboard alternative via `Alt+↑/↓` and a "Move" menu.
- Click to select; `Shift`-click for multi-select (v1: single select only; multi-select later).
- Inspector edits props with typed controls. A prop can be **literal** or **bound**; the binding picker lists inputs, vars, and step answers with their types.
- "Add question" opens a focused form for `choice`/`score`/`noul`, with a live example and criteria editor.
- The test bench runs the current draft against the selected connection, shows raw normalized answers, latency, and token usage.
- Validation panel surfaces: unresolved bindings, missing required inputs, empty criteria, inaccessible contrast, duplicate IDs, oversized state, too many steps/questions.
- Autosave debounced 800 ms; `draft_revision` guards against lost updates. Undo/redo keeps 100 entries in memory.
- `Cmd/Ctrl+K` command palette: add component, add question, jump to variable, run, publish.
- "Edit JSON" advanced mode for agents and power users; the same Zod schema validates it.

### 12.3 Templates

- **Blank**
- **Palette Oracle** (input → choice + scores → palette/canvas)
- **Vibe Check** (textarea → three scores → dials + verdict)
- **Cover Maker** (title → genre choice + scores → typographic cover)
- **Triage** (textarea → choice + score + noul → decision card)

Templates are ordinary blueprints stored in `src/lib/templates/` and are forkable.

### 12.4 Publish flow

1. Validate blueprint (schema + semantic checks).
2. Check required metadata, tags, and a 40–160 char tagline.
3. Confirm license/remixability and content policy.
4. Create `app_version` snapshot, update `app.published_version_id`, set `visibility = public`, sync FTS.
5. Return the public URL and a "share" sheet.

Editing a published app creates a new draft; the published version stays live until the next publish.

---

## 13. Marketplace

### 13.1 Catalog

- Sort: **Featured**, **New**, **Most run**, **Most remixed**.
- Filters: tag, engine capability (`text`, `image`), "runs with my connection".
- Search: FTS5 over title/tagline/description/tags/author, with typo-tolerant fallback (`LIKE`) for short queries.
- Cards show a generated preview (first render with sample inputs, no model call), title, tagline, author, run count, and 1–3 tags.
- Empty/zero-state copy is part of the design system, not an afterthought.

### 13.2 App detail

- Hero: title, tagline, author, tags, run count, like button, **Run** and **Remix**.
- Live preview panel: rendered with the app's sample inputs; "Run with your connection" to execute.
- "How it decides": the questions, options, and a sample probability distribution.
- Version history (public), changelog, remix lineage.
- Report link.

### 13.3 Publishing rules

- Public apps must pass schema validation and a basic content check.
- Every published version is immutable; edits create drafts.
- Remixable by default (CC BY 4.0); authors may choose "no remix" at publish, which hides the Remix button.
- One report opens a moderation item; three independent open reports auto-unlist pending review.
- Moderators can hide, unlist, or block an app and suspend an author. Every action writes `audit_log`.

### 13.4 Counters

- `run_count`, `remix_count`, and `like_count` are denormalized on `app` for fast sorting, updated with `ctx.waitUntil()`.
- `app_run` rows are retained 30 days for analytics, then pruned by a scheduled Worker. No inputs are stored.

---

## 14. Design

The full visual system is in **[docs/DESIGN.md](./docs/DESIGN.md)**. The short version:

- **Expressive minimal hybrid:** hexa.blue's whitespace, oversized type, and restraint; Material 3 Expressive's chunky shapes, tonal color, and springy motion.
- Warm paper canvas (`#F6F2E9`), ink text (`#16150F`), electric blue accent (`#006EFF` → `#00BFFF`), with pink/lime/tangerine/violet as functional accents.
- Display: Bricolage Grotesque. UI: Instrument Sans. Code: JetBrains Mono. Self-hosted via Fontsource.
- 20–32 px radii, pill buttons, 2 px ink outlines on "sticker" elements, soft shadows, 3% grain.
- Springy but restrained motion; `prefers-reduced-motion` respected everywhere.
- No chat UI, no glassmorphism, no purple-gradient-on-dark, no generic "AI" iconography.

---

## 15. Security, privacy, and abuse

### 15.1 Threat model

| Threat | Mitigation |
| --- | --- |
| Malicious app steals a runner's key | Declarative blueprints only; no code, no arbitrary URLs; keys never enter the renderer; proxy attaches credentials server-side. |
| XSS via app content | All text rendered as text (no `{@html}`); strict CSP; allowlisted components/props; URL props validated. |
| SSRF via custom base URL | Scheme/host allowlist, private-range denial, no redirects, timeouts, size caps. |
| Key leakage in logs/errors | Redaction layer; never log headers/bodies; provider errors mapped to safe codes. |
| Cost abuse | Per-IP/user/connection rate limits, daily caps, state size caps, question/step caps, token estimates. |
| Spam apps / unsafe content | Validation, reports, auto-unlist threshold, moderator tools, audit log. |
| CSRF | Better Auth session + same-site cookies; mutating routes require JSON content type and origin check. |
| Account takeover | Email verification, secure password hashing (Better Auth), OAuth state/PKCE, session revocation. |

### 15.2 CSP (baseline)

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' https://api.typesafe.ai https://laya-model.com
            https://clefdemo.com https://api.cloudflare.com
            http://localhost:* http://127.0.0.1:*;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

`style-src 'unsafe-inline'` is required by Svelte transitions in v1; revisit with hashes later. Local `http://` origins are included only when `ALLOW_LOCAL_ENDPOINTS=true`.

### 15.3 Privacy

- Do not persist app inputs or model state. Aggregate counters only.
- `app_run` stores app/version/provider/status/latency/tokens — never content.
- Account deletion cascades profile, connections, drafts, likes, and reports; published apps are anonymized or removed per user choice.
- Analytics are first-party and aggregate; no third-party trackers.
- A short, human-readable privacy page explains the key handling in plain language.

---

## 16. The JavaScript escape hatch (post-v1)

Declarative blueprints cover v1. Later, vetted apps may include JS **actions** (not full UI code):

- Actions run in a sandboxed iframe with a strict `postMessage` bridge, or in a separate Worker with no network access.
- No DOM access, no `fetch`, no storage. Inputs and answers are passed in; a typed result is passed out.
- Authors must pass a review checklist; the app detail page shows a "runs code" badge.
- The blueprint schema reserves `actions[].kind: "script"` and `runtime: "sandbox@1"` so v1 documents remain valid.

Do not implement this without a dedicated security review and a separate spec addendum.

---

## 17. Performance and accessibility

### 17.1 Budgets

- Catalog LCP **< 2.0 s** on a simulated 4G/mid-tier phone.
- Initial catalog JS **≤180 KB gzip**; runner chunk **≤90 KB**; editor chunk **≤160 KB**.
- Fonts: two variable families + one mono, subset to Latin, `font-display: swap`.
- No layout shift from late-loading previews; reserve aspect ratios.
- Model calls show a pending state within 100 ms; timeout at 15 s with a retry.

### 17.2 Accessibility

- WCAG 2.2 AA baseline: 4.5:1 text contrast, 3:1 non-text, 44×44 px targets, visible focus rings.
- Full keyboard path through catalog → detail → run → result; editor has a non-drag way to add/move components.
- `aria-live="polite"` for run status and results; errors use `role="alert"`.
- Never encode meaning in color alone: probabilities get labels, palettes get hex names, scores get numbers.
- `prefers-reduced-motion` disables spring/parallax/stagger; `prefers-contrast` strengthens borders.
- Test with axe in CI and a manual screen-reader pass per milestone.

---

## 18. Observability

- **Workers Logs** for structured server logs (`requestId`, route, status, latency, provider, error code). Never log keys, state, or user inputs.
- **Analytics Engine** events: `app_run`, `app_error`, `publish`, `fork`, `connection_test` with non-sensitive dimensions.
- Client error boundary reports `appId`, `version`, `stepId`, and error code — no payloads.
- Dashboards: runs/day, success rate, p50/p95 latency by provider, token spend estimate, report queue depth.
- Alerts: provider error rate >5% over 15 min; publish failures >2%; D1 errors.

---

## 19. Testing and CI

| Layer | What |
| --- | --- |
| Unit | Zod schemas, binding resolver, transforms, palette math, normalization, slug/handle rules |
| Contract | Recorded fixtures for Jev/Laya/Clef/CF; snapshot normalized answers; error mapping |
| Integration | Miniflare D1, Better Auth flows, connection encryption round-trip, publish batch |
| E2E | Guest run with mocked provider; sign-up → connect → build → publish → fork → report |
| Visual | Playwright screenshots at 390/768/1280; axe checks on key routes |
| Security | SSRF table tests, CSP header assertions, redaction tests, rate-limit tests |

CI (GitHub Actions):

```bash
bun install --frozen-lockfile
bun run check
bun run test
bun run build
bunx wrangler deploy --dry-run
```

Deploy on `main` after CI, with a manual approval gate for production migrations.

---

## 20. Deployment and configuration

### 20.1 Bindings

| Binding | Type | Purpose |
| --- | --- | --- |
| `DB` | D1 | Primary database |
| `RATE_LIMITER` | Rate Limiting | Per-IP/user/connection limits |
| `ASSETS` | R2 (later) | App icons/uploads (v1: none) |
| `ANALYTICS` | Analytics Engine | Product metrics |

### 20.2 Secrets

| Secret | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Session signing |
| `BETTER_AUTH_URL` | Canonical origin |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `ENCRYPTION_KEY` | AES-256-GCM key for connection secrets |
| `ENCRYPTION_KEYS` | Rotation map (optional) |
| `RESEND_API_KEY` | Verification/reset email |
| `EMAIL_FROM` | Sender address |

### 20.3 Vars

| Var | Default | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | `development` / `production` |
| `ALLOW_LOCAL_ENDPOINTS` | `true` (dev), `false` (prod) | Permit `http://localhost` direct mode |
| `ALLOW_CUSTOM_ENDPOINTS` | `true` | Permit user-supplied base URLs |
| `MAX_RUNS_PER_DAY` | `500` | Per-user/guest daily cap |
| `MAX_TOKENS_PER_DAY` | `2_000_000` | Soft cost guard |

### 20.4 First deploy checklist

- [ ] Create D1 database, put `database_id` in `wrangler.toml`.
- [ ] Apply migrations (`wrangler d1 migrations apply DB --remote`).
- [ ] Set all secrets (`wrangler secret put …`).
- [ ] Configure OAuth callback URLs (`/api/auth/callback/google`, `/api/auth/callback/github`).
- [ ] Verify Resend domain and sender.
- [ ] Run a smoke test: sign up, connect, run a seed app, publish a draft.
- [ ] Enable Workers Logs and the analytics dashboard.

---

## 21. Open questions

These need a decision before the phase that depends on them. Defaults are suggestions, not commitments.

| # | Question | Default | Needed by |
| --- | --- | --- | --- |
| 1 | Email provider: Resend vs Postmark vs console-only for beta? | Resend | Phase 0 |
| 2 | Require email verification to publish only, or to run too? | Publish only | Phase 0 |
| 3 | App icon: emoji, generated gradient, or upload? | Emoji + accent gradient | Phase 3 |
| 4 | Default license: CC BY 4.0 vs CC0? | CC BY 4.0 | Phase 4 |
| 5 | Allow "no remix" apps? | Yes, opt-out | Phase 4 |
| 6 | Auto-unlist threshold for reports? | 3 independent reports | Phase 4 |
| 7 | Show raw provider name on app pages? | Yes, "Runs on Jev/Laya/Clef" | Phase 2 |
| 8 | Support Cloudflare Workers AI direct in v1? | Yes, as a fifth adapter | Phase 1 |
| 9 | Retain `app_run` rows 30 or 90 days? | 30 days | Phase 4 |
| 10 | Custom domain and brand assets? | `jevil.app` placeholder | Phase 5 |

---

## 22. Definition of done — v1 public beta

- [ ] An anonymous visitor can browse, open, and run a published app with a guest cloud key **and** a local endpoint, without an account.
- [ ] Email/password, Google, and GitHub sign-in work; email verification gates publishing.
- [ ] Account connections are encrypted at rest, never returned to the client, and survive a device change.
- [ ] All five adapters pass contract tests; provider errors are user-readable.
- [ ] The editor can build the Palette Oracle from scratch (input → questions → vars → canvas → publish) in under 10 minutes.
- [ ] Publish creates an immutable version; fork preserves attribution; likes and reports work.
- [ ] No secret appears in the client bundle, D1 plaintext, logs, or error responses (verified by test).
- [ ] CSP, SSRF, rate-limit, and redaction tests pass.
- [ ] Catalog Lighthouse: performance ≥90, accessibility ≥95; axe clean on key routes.
- [ ] D1 migrations are reproducible from zero; CI is green; `wrangler deploy --dry-run` succeeds.
- [ ] Three seed apps are live and look good on mobile and desktop.

---

## 23. References

- Jev API docs — <https://docs.typesafe.ai/api/system-one>
- Jev model list and aliases — <https://docs.typesafe.ai/models>
- Laya community docs — <https://laya-model.com/docs/api>
- Laya upstream — <https://github.com/NandhaKishorM/laya>
- Clef Omni API — <https://clefdemo.com/docs/api/clef-omni/>
- Cloudflare Workers AI Clef — <https://developers.cloudflare.com/workers-ai/models/clef/>
- Cloudflare D1 — <https://developers.cloudflare.com/d1/>
- SvelteKit adapter-cloudflare — <https://svelte.dev/docs/kit/adapter-cloudflare>
- Better Auth — <https://www.better-auth.com/docs>
- Tailwind CSS v4 — <https://tailwindcss.com/docs>
- Material 3 Expressive — <https://m3.material.io/blog/building-with-m3-expressive>
- HexaBlue (visual reference) — <https://hexa.blue>
