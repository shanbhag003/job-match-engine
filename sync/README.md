# Cross-device sync (Cloudflare Worker + KV)

A tiny always-on serverless endpoint that stores your **applied** and
**not-interested** status so it's the same on every device. Free tier is far
more than enough (100k reads/day, 1k writes/day).

Your **sync code** is both your identity and your password: anyone who knows it
can read/write that status, nobody else can. Pick something long and private
(e.g. `kartik-jobs-8f3k2`). The only data stored is job ids + timestamps.

## Deploy (one time, ~3 minutes)

```bash
cd sync
npm install
npx wrangler login                 # opens the browser; free Cloudflare account
npm run kv:create                  # prints an id line for the "JMP" namespace
```

Copy the printed `id` into [`wrangler.toml`](wrangler.toml) (replace
`REPLACE_WITH_YOUR_KV_NAMESPACE_ID`), then:

```bash
npm run deploy
```

Wrangler prints your Worker URL, e.g. `https://job-match-sync.<you>.workers.dev`.
That's your **sync endpoint**.

## Turn it on in the app

- Open the app → **Sync** (top bar) → paste the Worker URL + a sync code → **Connect**.
- Do the same on your other device with the **same code**. Done — status now
  syncs both ways.

Optional: to skip pasting the URL on each device, set a repository **variable**
(not secret) named `SYNC_URL` to the Worker URL
(Settings → Secrets and variables → Actions → Variables). The Pages build then
pre-fills it, so each device only needs the code.

## How sync behaves

- On load, the app **pulls** remote status and **merges** it with local (so an
  application is never lost), then **pushes** the result.
- Every change (apply / mark applied / not-interested) pushes within ~1s.
- Merge is additive-safe: applying on one device shows up on all. Un-applying or
  restoring propagates on the next change from that device; if it lingers on
  another device, toggle it there once.

## API

```
GET  /state?code=CODE   -> { applied, hidden, updatedAt }   (empty object if new)
PUT  /state?code=CODE    body { applied, hidden, updatedAt } -> { ok: true }
```

CORS is open so the static site can call it. Rotate a code simply by choosing a
new one (the old blob is abandoned; delete it with
`npx wrangler kv key delete --binding JMP "state:OLDCODE"` if you like).
