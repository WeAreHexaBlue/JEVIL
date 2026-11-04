# AGENTS.md — working on JEVIL

This file is the contract for any agent (or human) contributing to JEVIL. Read it before touching code.

## 1. What this repo is

JEVIL is a marketplace for small, playful apps powered by **decision models** — Jev, Laya, and Clef — instead of chat models. Users bring an API key or a local endpoint, run declarative mini-apps, and get designed visual results. Makers build apps in a no-code editor and publish them.

**Current status (2026-11-04):** phases 0 and 1 are implemented — auth, design system, encrypted account connections, guest browser connections, local endpoints, the decide bench, rate limits, and adapter contract tests. Live hosted-provider calls still need real keys. The next milestone is Phase 2 in [ROADMAP.md](./ROADMAP.md).

## 2. Read order

1. [SPEC.md](./SPEC.md) — product, architecture, data model, security.
2. [ROADMAP.md](./ROADMAP.md) — phases, tasks, exit criteria. Pick the first unchecked task in the current phase.
3. [docs/APP-FORMAT.md](./docs/APP-FORMAT.md) — **normative** blueprint schema. Do not invent syntax outside it.
4. [docs/DESIGN.md](./docs/DESIGN.md) — visual system and component rules.

If a task contradicts these docs, stop and update the docs first (or ask), then implement.

## 3. Non-negotiable rules

- **Bun only.** Use `bun install`, `bun run`, `bun test`, `bunx`. Never add `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`.
- **Svelte 5 runes.** New components use `$state`, `$derived`, `$effect`, and snippets. Do not introduce Svelte stores for new code.
- **Tailwind CSS v4.** Tokens live in `src/app.css` under `@theme`. Do not add a second styling system or a component library that fights the design system.
- **Cloudflare Workers + D1.** Production runs on `workerd` via `adapter-cloudflare`. Do not use Bun-only APIs in `src/`. Local tooling may use Bun.
- **No arbitrary code in apps (v1).** Published apps are declarative JSON. Do not add `eval`, `new Function`, `{@html}`, iframes, or script actions without a dedicated security spec and review.
- **Never commit secrets.** No `.dev.vars`, API keys, OAuth secrets, or real provider tokens. Use `.dev.vars.example`.
- **Never log secrets or user content.** Do not log `authorization`, `cookie`, `x-jevil-key`, request bodies, model state, or full provider errors. Use the redaction helper.
- **Keys never reach the client for account connections.** Decrypt only server-side at call time. Guest keys are ephemeral request headers, never persisted.
- **Migrations are forward-only.** Commit them under `drizzle/`. Never edit an applied migration.
- **Validate at the boundary.** Zod schemas for every request, blueprint, and provider response. No `as` casts on untrusted data.
- **Text is text.** Render app strings as text nodes. No HTML injection, no inline CSS from blueprints, no `javascript:` URLs.
- **Accessibility is part of done.** Keyboard path, focus states, labels, contrast, reduced motion. See [DESIGN.md §12](./docs/DESIGN.md#12-accessibility).
- **Do not break `jevil/app@1`.** Additive changes only; bump the schema version for breaking changes and keep old apps running.

## 4. Commit format (mandatory)

Every commit message has exactly this shape:

```
<type>(<scope>): <imperative summary>
LLM: <model name>, <reasoning level>, <harness>, <inference provider>

<optional body>
```

- Line 1: conventional commit subject, ≤72 chars.
- **Line 2: the `LLM:` line. Always. No blank line before it.**
- Line 3: blank.
- Line 4+: optional body explaining *why*, not *what*.

The `LLM:` line identifies the model that produced the commit. Fill in your own values; never copy someone else's model name. The format is:

```
LLM: <model name>, <reasoning level>, <harness>, <inference provider>
```

**Example for this session (DeepSeek V4.1 Flash via T3 Code + OpenCode):**

```
docs: add roadmap and specs
LLM: DeepSeek v4.1 Flash 1017 (Free), High, T3 Code + OpenCode, OpenCode

Add SPEC, ROADMAP, APP-FORMAT, DESIGN, and AGENTS so implementation
can continue phase by phase.
```

Rules:

- The `LLM:` line is **line 2**, not a trailer at the end.
- Never omit it, even for docs, typos, or one-line fixes.
- Never wrap or reformat it.
- If you are an agent, substitute your actual model, reasoning level, harness, and inference provider.

Safe command:

```bash
git commit -m "$(cat <<'EOF'
feat(runtime): add score binding resolution
LLM: <model name>, <reasoning level>, <harness>, <inference provider>

Resolve score answers to 0..1 using the probability distribution, with
a raw-index fallback for providers that omit probabilities.
EOF
)"
```

## 5. Workflow

1. **Pick one task** from the current phase in [ROADMAP.md](./ROADMAP.md). Don't start later-phase UI while earlier runtime contracts are unstable.
2. **Check the exit criteria** for that phase before you start. They define "done".
3. **Implement in small commits.** Keep the phase demo script working after each merge.
4. **Write tests with the change**, especially for schemas, normalization, bindings, security, and encryption.
5. **Update docs** if behavior, schema, routes, or design tokens change.
6. **Run the checks** before committing:

```bash
bun run check
bun run test
bun run build
bunx wrangler deploy --dry-run   # once the Worker exists
```

7. **Commit** with the format above.

### Branching

- Docs-only changes may go directly to `main`.
- Code changes: use a short-lived branch (`phase-2/runtime`, `fix/score-normalize`) and open a PR when collaborating.
- Do not rewrite published history. Do not force-push shared branches.

## 6. Definition of done

A task is done when:

- [ ] It meets the acceptance criteria in the roadmap.
- [ ] Tests cover the new behavior and pass locally.
- [ ] `bun run check` and `bun run build` pass.
- [ ] No secrets, keys, or user content appear in code, logs, fixtures, or commits.
- [ ] Accessibility: keyboard path, labels, focus, contrast, reduced motion.
- [ ] Docs updated (schema, routes, env vars, design tokens) when relevant.
- [ ] The current phase demo script still works.
- [ ] Commit message follows §4.

## 7. Planned repository layout

```
.
├── SPEC.md
├── ROADMAP.md
├── AGENTS.md
├── docs/
│   ├── APP-FORMAT.md
│   ├── DESIGN.md
│   └── RUNBOOK.md            # phase 5
├── drizzle/                  # migrations (forward-only)
├── examples/
│   └── laya-local-bridge/    # System One HTTP wrapper (phase 2)
├── src/
│   ├── app.css               # Tailwind v4 @theme tokens
│   ├── app.html
│   ├── lib/
│   │   ├── components/       # design-system primitives
│   │   ├── runtime/          # blueprint interpreter, bindings, renderer
│   │   ├── schema/           # shared Zod schemas
│   │   ├── decide/           # normalized types + helpers
│   │   ├── templates/        # seed blueprints
│   │   ├── server/
│   │   │   ├── auth.ts
│   │   │   ├── crypto.ts
│   │   │   ├── db/
│   │   │   ├── providers/    # jev, laya, clef, cloudflare, systemone
│   │   │   └── redact.ts
│   │   └── utils/
│   └── routes/
│       ├── +layout.svelte
│       ├── +page.svelte
│       ├── apps/
│       ├── edit/
│       ├── settings/
│       ├── u/
│       ├── admin/
│       └── api/
├── static/
├── tests/
├── drizzle.config.ts
├── svelte.config.js
├── vite.config.ts
├── wrangler.toml
└── package.json
```

## 8. Commands (once scaffolded)

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Vite dev server with Cloudflare platform proxy |
| `bun run check` | `svelte-check` + TypeScript |
| `bun run test` | Vitest unit/contract tests |
| `bun run test:e2e` | Playwright |
| `bun run build` | Production build |
| `bun run db:generate` | Generate Drizzle migration |
| `bun run db:migrate:local` | Apply migrations to local D1 |
| `bun run db:migrate:remote` | Apply migrations to remote D1 |
| `bunx wrangler deploy --dry-run` | Verify the Worker bundle |
| `bunx wrangler deploy` | Deploy |

## 9. Security checklist for every PR

- [ ] No secret in the diff, fixtures, logs, or error messages.
- [ ] Account keys are encrypted at rest; guest keys are ephemeral.
- [ ] Custom URLs are validated (https, no private hosts, no redirects).
- [ ] Blueprint input is schema-validated; unknown fields rejected.
- [ ] No `{@html}`, `eval`, `new Function`, or inline script.
- [ ] CSP still passes; no new `connect-src` origin without review.
- [ ] Rate limits apply to new model-calling endpoints.
- [ ] Auth checks on every mutating route; ownership checks on app/connection writes.
- [ ] Error responses are safe and do not echo provider payloads.

## 10. When in doubt

- Prefer the smaller, safer, more boring implementation.
- Prefer a documented limitation over an undocumented behavior.
- Prefer updating the spec over silently diverging from it.
- Ask before adding a dependency, a provider, a schema field, or a code-execution path.
- If a task requires a product decision, use the question tool or leave a clear note in the PR; do not guess silently.
