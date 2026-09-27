import puppeteer from 'puppeteer'
import { KEYWORDS, CITIES, WORK_MODES } from './queries.js'
import { normalize } from './classify.js'

// ---------------------------------------------------------------------------
// Harvester: drives a headless browser to each Naukri search results page and
// captures Naukri's OWN /jobapi/v3/search JSON response (rather than forging
// the anti-bot token or scraping fragile HTML). Each captured record is
// normalized to the app's Job schema.
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const slug = (s) => s.trim().toLowerCase().replace(/\s+/g, '-')

function srpUrl(keyword, citySlug, wfhType) {
  const base = `https://www.naukri.com/${slug(keyword)}-jobs-in-${citySlug}`
  return wfhType ? `${base}?wfhType=${wfhType}` : base
}

/** Harvest all configured searches and return a de-duplicated Job[]. */
export async function harvest({ headless = true, log = console.log } = {}) {
  const browser = await puppeteer.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  const byId = new Map()

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    )
    await page.setViewport({ width: 1366, height: 900 })

    for (const keyword of KEYWORDS) {
      for (const city of CITIES) {
        for (const mode of WORK_MODES) {
          let captured = null
          const onResponse = async (res) => {
            const url = res.url()
            if (url.includes('/jobapi/v3/search') && res.request().method() === 'GET') {
              try {
                const json = await res.json()
                if (json && Array.isArray(json.jobDetails)) captured = json.jobDetails
              } catch {
                /* non-JSON or already consumed */
              }
            }
          }
          page.on('response', onResponse)
          try {
            await page.goto(srpUrl(keyword, city.slug, mode.wfhType), {
              waitUntil: 'networkidle2',
              timeout: 45000,
            })
            // Give the SRP a beat to fire its API call if it hasn't yet.
            for (let i = 0; i < 10 && !captured; i++) await sleep(500)
          } catch (e) {
            log(`  ! ${keyword} / ${city.slug} / ${mode.workMode}: ${e.message}`)
          } finally {
            page.off('response', onResponse)
          }

          let added = 0
          for (const jd of captured || []) {
            const job = normalize(jd, { workMode: mode.workMode })
            if (!job) continue
            if (!byId.has(job.id)) {
              byId.set(job.id, job)
              added++
            }
          }
          log(`  ✓ ${keyword} / ${city.slug} / ${mode.workMode}: +${added} (total ${byId.size})`)
          await sleep(1200) // politeness delay between requests
        }
      }
    }
  } finally {
    await browser.close()
  }

  return [...byId.values()]
}
