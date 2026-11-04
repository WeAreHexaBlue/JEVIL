# Laya local bridge

A tiny [System One](../../SPEC.md#104-system-one-http-contract-localcustom)
endpoint so JEVIL can talk to a model running on your machine. It speaks the
same contract as the hosted providers: `GET /health` and `POST /v1/decide`.

The browser calls this process directly. JEVIL's server never sees your
`localhost` URL or any key you set here.

## Run it

```bash
cd examples/laya-local-bridge
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

It listens on <http://127.0.0.1:8000> by default.

- Without `LAYAAI_API_KEY` it answers deterministically, which is enough to
  exercise the UI and the bridge contract.
- With a key it forwards each decide call to Laya's hosted API:

    ```bash
    export LAYAAI_API_KEY="laya_…"
    python app.py
    ```

| Variable          | Default                       | Purpose                                              |
| ----------------- | ----------------------------- | ---------------------------------------------------- |
| `LAYAAI_API_KEY`  | empty                         | Forward to Laya instead of the deterministic answers |
| `LAYAAI_BASE_URL` | `https://api.layaaimodel.com` | Hosted endpoint to forward to                        |
| `BRIDGE_MODEL`    | `convaiinnovations/laya`      | Model name reported by `/health`                     |
| `JEVIL_ORIGIN`    | `http://localhost:5173`       | Allowed CORS origin                                  |
| `PORT`            | `8000`                        | Listen port (loopback only)                          |

## Connect JEVIL

1. Run JEVIL with `bun run dev` and open <http://localhost:5173>.
2. Sign in, then open **Connections**.
3. Add **Local / custom** with base URL `http://localhost:8000`.
4. Press **Test**, then **Bench**.

Local endpoints are enabled by `ALLOW_LOCAL_ENDPOINTS=true`, which
`wrangler.jsonc` sets for development. Production rejects loopback hosts; a
local model is always called from the browser, never proxied.

## Check it by hand

```bash
curl http://localhost:8000/health

curl -X POST http://localhost:8000/v1/decide \
  -H 'content-type: application/json' \
  -d '{"state":"a moody forest","questions":{"mood":{"type":"noul","instructions":"How moody?"}}}'
```

## CORS

The bridge already sends the headers JEVIL needs:

```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Headers: authorization, content-type, x-api-key
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

If you open JEVIL on a different origin, set `JEVIL_ORIGIN` to match exactly
(scheme, host, and port). A mismatch shows up as a blocked request in the
browser console, not as a server error.

## Scope

This is a reference example, not a production server. It has no authentication,
no persistence, and no rate limiting; keep it on loopback.
