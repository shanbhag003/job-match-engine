import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { readFile } from 'node:fs/promises'
import { runScrape, FEED_PATH } from './scrape.js'

// ---------------------------------------------------------------------------
// Feed server: serves the harvested jobs.json with CORS, refreshes it hourly
// via cron, and scrapes once on boot if the feed is missing/stale.
// Point the frontend at this with VITE_JOBS_FEED_URL (see frontend README).
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 8787
const app = express()
app.use(cors()) // allow the static frontend (any origin) to fetch the feed

let lastFeed = null

async function loadFeedFromDisk() {
  try {
    lastFeed = JSON.parse(await readFile(FEED_PATH, 'utf8'))
  } catch {
    lastFeed = null
  }
}

app.get('/health', (_req, res) => res.json({ ok: true, generatedAt: lastFeed?.generatedAt ?? null }))

app.get('/jobs.json', async (_req, res) => {
  if (!lastFeed) await loadFeedFromDisk()
  if (!lastFeed) return res.status(503).json({ error: 'feed not ready yet' })
  res.json(lastFeed)
})

async function refresh() {
  try {
    lastFeed = await runScrape()
  } catch (e) {
    console.error('[server] scrape failed, keeping previous feed:', e.message)
  }
}

app.listen(PORT, async () => {
  console.log(`[server] listening on http://localhost:${PORT}  (GET /jobs.json)`)
  await loadFeedFromDisk()
  // Scrape on boot if we have no feed or it's older than an hour.
  const ageMs = lastFeed ? Date.now() - new Date(lastFeed.generatedAt).getTime() : Infinity
  if (ageMs > 60 * 60 * 1000) await refresh()
  else console.log(`[server] serving cached feed from ${lastFeed.generatedAt}`)

  // Refresh every hour, on the hour.
  cron.schedule('0 * * * *', () => {
    console.log('[server] hourly refresh triggered')
    refresh()
  })
})
