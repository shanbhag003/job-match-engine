import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { harvest } from './harvest.js'

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
  const jobs = await harvest({ log })

  // Enforce product rules at the boundary (belt-and-braces; harvest already does).
  const clean = jobs.filter(
    (j) =>
      (j.city === 'Navi Mumbai' || j.city === 'Mumbai') &&
      (j.workMode === 'On-site' || j.workMode === 'Hybrid'),
  )

  const feed = {
    generatedAt: new Date().toISOString(),
    source: 'Naukri.com',
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
