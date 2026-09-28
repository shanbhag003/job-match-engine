// ---------------------------------------------------------------------------
// Job Match Engine — cross-device sync Worker (Cloudflare Workers + KV).
//
// Stores each user's applied / not-interested status as one JSON blob, keyed by
// a private "sync code" the user chooses. The code is both the identity and the
// access token: anyone with the code can read/write that blob, nobody else can.
// No accounts, no personal data beyond job ids + timestamps.
//
//   GET  /state?code=XXXX  -> { applied, hidden, updatedAt }   (empty if none)
//   PUT  /state?code=XXXX  body { applied, hidden, updatedAt } -> { ok: true }
//
// CORS is open so the static site (any origin) can call it.
// ---------------------------------------------------------------------------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    const url = new URL(request.url)
    if (url.pathname !== '/state') return json({ error: 'not found' }, 404)

    const code = (url.searchParams.get('code') || '').trim()
    if (code.length < 6) return json({ error: 'sync code must be at least 6 characters' }, 400)
    const key = `state:${code}`

    if (request.method === 'GET') {
      const stored = await env.JMP.get(key)
      if (!stored) return json({ applied: {}, hidden: {}, updatedAt: 0 })
      return new Response(stored, {
        status: 200,
        headers: { ...CORS, 'content-type': 'application/json' },
      })
    }

    if (request.method === 'PUT') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ error: 'invalid JSON' }, 400)
      }
      const clean = {
        applied: body.applied && typeof body.applied === 'object' ? body.applied : {},
        hidden: body.hidden && typeof body.hidden === 'object' ? body.hidden : {},
        updatedAt: Number(body.updatedAt) || Date.now(),
      }
      const payload = JSON.stringify(clean)
      if (payload.length > 512 * 1024) return json({ error: 'payload too large' }, 413)
      await env.JMP.put(key, payload)
      return json({ ok: true, updatedAt: clean.updatedAt })
    }

    return json({ error: 'method not allowed' }, 405)
  },
}
