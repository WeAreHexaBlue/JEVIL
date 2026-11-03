# Manual setup

Everything a human has to do outside the repository: secrets, OAuth apps, D1,
email, and the first deploy. The app runs locally with only Bun; Cloudflare and
Resend are needed for deploys and real email.

Work through the sections in order. Nothing here contains a real secret.

---

## 1. Prerequisites

| Tool | Why |
| --- | --- |
| [Bun](https://bun.sh) 1.2+ | install, scripts, tests |
| A Cloudflare account | D1, Workers, production deploys |
| A Resend account (optional) | verification and reset email |
| Google and/or GitHub account (optional) | social sign-in |

You do **not** need Node, npm, pnpm, or Yarn. Do not create their lockfiles.

---

## 2. Local install

```bash
git clone https://github.com/WeAreHexaBlue/JEVIL.git
cd JEVIL
bun install
cp .env.example .env
```

Generate the session secret and put it in `.env`:

```bash
openssl rand -hex 32
```

```dotenv
ORIGIN="http://localhost:5173"
BETTER_AUTH_SECRET="<the hex string>"
```

`ORIGIN` must match the URL you open in the browser, including the port. OAuth
callbacks and verification links are built from it.

Optional now, required once connections ship:

```bash
openssl rand -base64 32   # ENCRYPTION_KEY
```

```dotenv
ENCRYPTION_KEY="<the base64 string>"
```

> Never commit `.env`. It is gitignored. `.env.example` stays blank.

### Local D1

The local database is a file under `.wrangler/`, so no Cloudflare account is
needed yet. Apply the committed migrations:

```bash
bun run db:migrate:local
```

This runs `wrangler d1 migrations apply jevil --local` against the `DB` binding
in `wrangler.jsonc`. Re-run it after pulling new migrations.

### Run it

```bash
bun run dev
```

Open <http://localhost:5173>. Sign up with email and password at `/sign-up`.
With no Resend key, the verification and reset links print in the terminal:

```
[email:dev] Confirm your email for JEVIL — http://localhost:5173/api/auth/verify-email?token=…
```

Open that link to confirm. The `/me` page shows a banner with a resend button
while the address is unconfirmed. Verification gates publishing only; you can
sign in and use the site without it.

---

## 3. Google sign-in (optional)

1. Open <https://console.cloud.google.com/apis/credentials>.
2. Create or select a project.
3. Configure the **OAuth consent screen** (External is fine). Add your own
   address as a test user while the app is in testing.
4. **Create credentials → OAuth client ID → Web application**.
5. Add the authorized origins and redirect URIs:

   | Field | Development | Production |
   | --- | --- | --- |
   | JavaScript origin | `http://localhost:5173` | `https://your.domain` |
   | Redirect URI | `http://localhost:5173/api/auth/callback/google` | `https://your.domain/api/auth/callback/google` |

6. Copy the client ID and secret into `.env`:

   ```dotenv
   GOOGLE_CLIENT_ID="…apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="…"
   ```

The Google button appears only when both values are set.

---

## 4. GitHub sign-in (optional)

1. Open <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**.
2. Fill in:

   | Field | Development | Production |
   | --- | --- | --- |
   | Application name | `JEVIL (dev)` | `JEVIL` |
   | Homepage URL | `http://localhost:5173` | `https://your.domain` |
   | Authorization callback URL | `http://localhost:5173/api/auth/callback/github` | `https://your.domain/api/auth/callback/github` |

3. **Register application**, then **Generate a new client secret**.
4. Put both values in `.env`:

   ```dotenv
   GITHUB_CLIENT_ID="…"
   GITHUB_CLIENT_SECRET="…"
   ```

GitHub allows one callback URL per OAuth app. Use a second OAuth app for
production rather than editing the development one on every deploy.

Restart `bun run dev` after changing `.env`.

---

## 5. Resend email (optional locally, required in production)

In development, leaving `RESEND_API_KEY` empty is supported: links print to the
console and nothing is sent.

For real delivery:

1. Create an account at <https://resend.com>.
2. **Domains → Add domain**, add the DNS records Resend shows, and wait for
   verification. `onboarding@resend.dev` only delivers to your own address, so
   it is fine for a smoke test but not for users.
3. **API Keys → Create API key** with sending permission.
4. Set both values:

   ```dotenv
   RESEND_API_KEY="re_…"
   EMAIL_FROM="JEVIL <hello@your.domain>"
   ```

In production, `src/lib/server/email.ts` throws when `RESEND_API_KEY` is missing
and `ENVIRONMENT=production`, so the feature fails loudly instead of silently
dropping mail.

---

## 6. Cloudflare D1

Local development uses a local database; production needs a real D1 database.

```bash
bunx wrangler login
bunx wrangler d1 create jevil
```

The command prints a `database_id`. Replace the placeholder in
`wrangler.jsonc`:

```jsonc
"d1_databases": [
    {
        "binding": "DB",
        "database_name": "jevil",
        "database_id": "<the id wrangler printed>",
        "migrations_dir": "drizzle"
    }
]
```

If the database already exists, find its id with `bunx wrangler d1 list`.

Apply the migrations to the remote database:

```bash
bunx wrangler d1 migrations apply jevil --remote
```

Migrations are forward-only. To change the schema, edit
`src/lib/server/db/schema.ts`, run `bun run db:generate`, commit the new SQL, and
apply it. Never edit or delete an applied migration; the conventions check
fails the build if you do.

### Drizzle HTTP credentials (only for remote `drizzle-kit` commands)

`drizzle.config.ts` reads these three values from `.env`; they are not needed for
`bun run dev`, `db:migrate:local`, or `db:migrate:remote`:

```dotenv
CLOUDFLARE_ACCOUNT_ID="…"
CLOUDFLARE_DATABASE_ID="…"
CLOUDFLARE_D1_TOKEN="…"
```

- Account id: Cloudflare dashboard → **Workers & Pages** → account overview.
- Token: **My Profile → API Tokens → Create Token**, custom token with
  **D1: Edit** permission for the account.

---

## 7. Production deploy

Before the first real deploy, review `wrangler.jsonc`:

```jsonc
"vars": {
    "ENVIRONMENT": "production",
    "ALLOW_LOCAL_ENDPOINTS": "false",
    "ALLOW_CUSTOM_ENDPOINTS": "true"
}
```

- `ENVIRONMENT=production` makes missing email credentials fatal.
- `ALLOW_LOCAL_ENDPOINTS=false` prevents server-side requests to localhost.
- Keep `ALLOW_CUSTOM_ENDPOINTS=true` only if users may bring a custom base URL;
  the SSRF guard still applies.

Set the production secrets:

```bash
bunx wrangler secret put BETTER_AUTH_SECRET
bunx wrangler secret put ENCRYPTION_KEY        # or ENCRYPTION_KEYS
bunx wrangler secret put ORIGIN                # https://your.domain
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put EMAIL_FROM
# optional, if you enabled them:
bunx wrangler secret put GOOGLE_CLIENT_ID
bunx wrangler secret put GOOGLE_CLIENT_SECRET
bunx wrangler secret put GITHUB_CLIENT_ID
bunx wrangler secret put GITHUB_CLIENT_SECRET
```

Generate a **new** `BETTER_AUTH_SECRET` and `ENCRYPTION_KEY` for production. Do
not reuse local values. For key rotation, set `ENCRYPTION_KEYS` to a JSON map of
version → base64 key; new writes use the highest version and old ciphertexts
stay readable.

Deploy:

```bash
bun run build
bunx wrangler deploy
```

Then update the OAuth apps with the production origin and callback URLs from
sections 3 and 4, and add the custom domain in the Cloudflare dashboard if you
use one. `workers_dev` and `preview_urls` are enabled in `wrangler.jsonc`; turn
them off when the custom domain is live.

---

## 8. Verify the setup

```bash
bun run check
bun run test
bun run lint
bun run build
bunx wrangler deploy --dry-run
```

Then exercise the auth flow:

1. Sign up with email → land on `/me` → see the confirmation banner.
2. Open the console link → `/verify` says the email is confirmed.
3. Sign out → **Forgot password?** on `/sign-in` → request a link → set a new
   password → sign in with it.
4. Sign in with Google or GitHub if configured.
5. Visit a missing route → branded 404.

Production smoke test: repeat 1–3 against the deployed URL, with a real inbox
when Resend is configured.

---

## 9. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `D1 binding "DB" not found` | The app is not running through Wrangler. Use `bun run dev` or `bun run preview`, not bare `vite`. |
| `redirect_uri_mismatch` | The redirect URI must match exactly: scheme, host, port, and path. Check `ORIGIN` too. |
| Verification link points at localhost in production | `ORIGIN` secret is still local. Set it to the production URL and redeploy. |
| No email arrives in development | Expected without Resend; search the terminal for `[email:dev]`. |
| `RESEND_API_KEY is not configured` | Production requires the secret, or set `ENVIRONMENT=development` for a preview. |
| `Invalid D1 credentials` from `drizzle-kit` | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, and `CLOUDFLARE_D1_TOKEN` must all be set for remote studio/generate. |
| OAuth button missing | Both the client id and secret must be present; restart the dev server after editing `.env`. |
| Migration check fails in CI | An applied `drizzle/*.sql` file was edited or deleted. Add a new migration instead. |

---

## 10. What CI needs

Nothing beyond the repository. `.github/workflows/ci.yml` uses a dummy
`BETTER_AUTH_SECRET` and `ORIGIN`, installs with `bun install --frozen-lockfile`,
generates Worker types, runs checks/tests/build, applies migrations from zero,
and verifies the Worker bundle. Deploy workflows, if added later, need the
Cloudflare and OAuth values as GitHub Actions secrets — never in the repo.
