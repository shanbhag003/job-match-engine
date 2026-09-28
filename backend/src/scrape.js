import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { harvest } from './harvest.js'
import { fetchAdzuna } from './adzuna.js'
import { fetchSerpJobs } from './serpapi.js'

// ---------------------------------------------------------------------------
// Orchestrator: harvest -> filter (Navi Mumbai / Mumbai, Hybrid / On-site only)
// -> write data/jobs.json. Run directly (`npm run scrape`) or via the server's
// hourly cron. Writes an atomic feed the frontend fetches.
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
export const FEED_PATH = join(__dirname, '..', 'data', 'jobs.json')

export async function runScrape({ log = console.log } = {}) {
  const started = Date.now()
  log(`[scrape] starting harvest at ${new Date().toISOString()}`)

  // Gather from every configured source. Add more sources here — each just
  // returns Job[] with its own `source` label; the scorer/UI need no changes.
  const naukri = await harvest({ log })
  const adzuna = await fetchAdzuna({ log })
  const serp = await fetchSerpJobs({ log })
  const all = [...naukri, ...adzuna, ...serp]

  // Enforce product rules at the boundary (belt-and-braces; sources already do).
  const inScope = all.filter(
    (j) =>
      (j.city === 'Navi Mumbai' || j.city === 'Mumbai') &&
      (j.workMode === 'On-site' || j.workMode === 'Hybrid'),
  )

  // De-duplicate the same posting appearing on more than one source
  // (keep the first — Naukri is listed first). Match on title + company + city.
  const seen = new Set()
  const clean = inScope.filter((j) => {
    const key = `${j.title.toLowerCase().trim()}|${j.company.toLowerCase().trim()}|${j.city}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const bySource = clean.reduce((m, j) => ((m[j.source] = (m[j.source] || 0) + 1), m), {})
  log(`[scrape] by source: ${JSON.stringify(bySource)}`)

  const feed = {
    generatedAt: new Date().toISOString(),
    sources: bySource, // e.g. { "Naukri.com": 22, "Adzuna": 14 }
    count: clean.length,
    jobs: clean,
  }

  await mkdir(dirname(FEED_PATH), { recursive: true })
  await writeFile(FEED_PATH, JSON.stringify(feed, null, 2), 'utf8')

  const naviCount = clean.filter((j) => j.city === 'Navi Mumbai').length
  log(
    `[scrape] wrote ${clean.length} jobs (${naviCount} Navi Mumbai) to ${FEED_PATH} in ${(
      (Date.now() - started) / 1000
    ).toFixed(1)}s`,
  )
  return feed
}

// Run when invoked directly.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('scrape.js')) {
  runScrape().catch((e) => {
    console.error('[scrape] failed:', e)
    process.exit(1)
  })
}
