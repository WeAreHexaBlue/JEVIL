# JEVIL

A marketplace for tiny apps powered by **decision models** — Jev, Laya, and Clef — instead of chat.

> Small apps. Sharp decisions.

A word goes in, a palette comes out. A vibe goes in, a score comes out. No chat bubbles, no streaming text — just structured answers rendered as something you can see.

## Status

Phases 0–2 — foundations, connections, and the runtime. The shell, auth, design tokens, D1 schema, encrypted connections, guest and local endpoints, the decide bench, the `jevil/app@1` validator and interpreter, the renderer, and three seed apps (Palette Oracle, Vibe Check, Cover Maker) exist. The no-code editor is next. See [ROADMAP.md](./ROADMAP.md).

## Stack

- **SvelteKit 3** with Svelte 5 runes
- **Tailwind CSS v4** with tokens in `src/app.css`
- **Light, dark, and system themes** with a persisted, no-flash switch
- **Cloudflare Workers** via `@sveltejs/adapter-cloudflare`
- **D1** with Drizzle ORM (forward-only migrations)
- **Better Auth** — email/password, Google, GitHub, email verification, and password reset
- **Paraglide** for UI strings (`messages/en.json`)
- **Bun** for install, scripts, and tests

## Read first

1. [SPEC.md](./SPEC.md) — product, architecture, data model, security
2. [ROADMAP.md](./ROADMAP.md) — phases and exit criteria
3. [docs/APP-FORMAT.md](./docs/APP-FORMAT.md) — the `jevil/app@1` blueprint schema
4. [docs/DESIGN.md](./docs/DESIGN.md) — visual system
5. [AGENTS.md](./AGENTS.md) — contribution rules and commit format
6. [docs/SETUP.md](./docs/SETUP.md) — manual OAuth, D1, email, and deploy steps

## Local setup

Requires [Bun](https://bun.sh) and a Cloudflare account for deploys (not for local work).

```bash
bun install
cp .env.example .env
# put a real secret in .env:
#   openssl rand -hex 32
bun run db:migrate:local
bun run dev
```

The dev server runs SvelteKit with Wrangler's platform proxy, so the `DB` binding and local D1 database work without a remote account.

For OAuth apps, Resend, remote D1, production secrets, and troubleshooting, follow [docs/SETUP.md](./docs/SETUP.md).

### Environment

| Variable                                    | Required        | Purpose                                        |
| ------------------------------------------- | --------------- | ---------------------------------------------- |
| `ORIGIN`                                    | yes             | Canonical origin, e.g. `http://localhost:5173` |
| `BETTER_AUTH_SECRET`                        | yes             | Session signing secret, 32+ random bytes       |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no              | Enables Google sign-in                         |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | no              | Enables GitHub sign-in                         |
| `ENCRYPTION_KEY`                            | for connections | Provider credential encryption                 |
| `ENCRYPTION_KEYS`                           | no              | Rotation map; overrides `ENCRYPTION_KEY`       |
| `RESEND_API_KEY` / `EMAIL_FROM`             | no              | Verification and reset email; console in dev   |

OAuth callback URLs: `/api/auth/callback/google` and `/api/auth/callback/github`.

### Cloudflare

`wrangler.jsonc` binds D1 as `DB`. Create the database and replace the placeholder id before deploying:

```bash
bunx wrangler d1 create jevil
bunx wrangler d1 migrations apply jevil --remote
bun run build
bunx wrangler deploy
```

## Commands

| Command                          | Purpose                                   |
| -------------------------------- | ----------------------------------------- |
| `bun run dev`                    | Dev server with Cloudflare platform proxy |
| `bun run check`                  | Worker types, `svelte-check`, TypeScript  |
| `bun run test`                   | Vitest                                    |
| `bun run build`                  | Production build                          |
| `bun run lint`                   | Prettier check + ESLint                   |
| `bun run format`                 | Prettier write                            |
| `bun run db:generate`            | Generate a Drizzle migration              |
| `bun run db:migrate:local`       | Apply migrations to local D1              |
| `bun run db:migrate:remote`      | Apply migrations to remote D1             |
| `bun run auth:schema`            | Regenerate the Better Auth Drizzle schema |
| `bunx wrangler deploy --dry-run` | Verify the Worker bundle                  |

## Layout

```
src/
├── app.css                  design tokens and base styles
├── lib/
│   ├── theme.svelte.ts      light / dark / system preference
│   ├── components/          design-system primitives and shell
│   ├── schema/              shared Zod schemas
│   ├── server/              auth, db, profile helpers
│   └── paraglide/           generated (gitignored)
├── routes/                  pages and server actions
messages/en.json             UI strings
drizzle/                     forward-only migrations
```

## Licence

See [LICENSE](./LICENSE).
