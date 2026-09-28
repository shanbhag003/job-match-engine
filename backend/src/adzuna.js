import { classifyDomain, classifyRole, classifyCity, isStrictProductRole } from './classify.js'
import { KEYWORDS, CITIES } from './queries.js'
import { stripHtml, sleep, inferWorkMode, parseYears, extractSkills, fmtSalary, relTime } from './util.js'

// ---------------------------------------------------------------------------
// Adzuna adapter. Uses Adzuna's official free JSON API (India / country "in")
// to fetch product roles, mapped to the app's Job schema with source "Adzuna".
// Needs a free app id + key (https://developer.adzuna.com) passed as env vars
// ADZUNA_APP_ID / ADZUNA_APP_KEY. If unset, it's skipped gracefully.
// ---------------------------------------------------------------------------

function mapAdzuna(r) {
  const title = stripHtml(r.title || '')
  if (!isStrictProductRole(title)) return null
  const loc = r.location?.display_name || ''
  const city = classifyCity(loc)
  if (!city) return null
  const desc = stripHtml(r.description || '')
  const workMode = inferWorkMode(`${title} ${desc}`)
  if (!workMode) return null // remote excluded
  const exp = parseYears(desc)
  return {
    id: `adzuna-${r.id}`,
    title,
    company: r.company?.display_name || 'Undisclosed',
    city,
    locationRaw: loc || city,
    workMode,
    expMin: exp.min,
    expMax: exp.max,
    domain: classifyDomain(`${title} ${desc}`),
    role: classifyRole(title, '', desc),
    requiredSkills: extractSkills(`${title} ${desc}`),
    summary: desc.slice(0, 240) || title,
    applyUrl: r.redirect_url || 'https://www.adzuna.in',
    salary: fmtSalary(r.salary_min, r.salary_max),
    postedRelative: relTime(r.created),
    source: 'Adzuna',
    capturedOn: new Date().toISOString().slice(0, 10),
  }
}

/** Fetch product roles from Adzuna for the configured keywords × cities. */
export async function fetchAdzuna({
  appId = process.env.ADZUNA_APP_ID,
  appKey = process.env.ADZUNA_APP_KEY,
  maxDaysOld = 45,
  log = console.log,
} = {}) {
  if (!appId || !appKey) {
    log('[adzuna] ADZUNA_APP_ID / ADZUNA_APP_KEY not set — skipping Adzuna source')
    return []
  }
  const byId = new Map()
  for (const keyword of KEYWORDS) {
    for (const city of CITIES) {
      const url =
        `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}&app_key=${appKey}` +
        `&results_per_page=50&what=${encodeURIComponent(keyword)}` +
        `&where=${encodeURIComponent(city.location)}&max_days_old=${maxDaysOld}&content-type=application/json`
      try {
        const res = await fetch(url)
        if (!res.ok) {
          log(`  ! adzuna ${keyword} / ${city.location}: HTTP ${res.status}`)
          continue
        }
        const data = await res.json()
        let added = 0
        for (const r of data.results || []) {
          const job = mapAdzuna(r)
          if (job && !byId.has(job.id)) {
            byId.set(job.id, job)
            added++
          }
        }
        log(`  ✓ adzuna ${keyword} / ${city.location}: +${added} (total ${byId.size})`)
      } catch (e) {
        log(`  ! adzuna ${keyword} / ${city.location}: ${e.message}`)
      }
      await sleep(300) // gentle pacing
    }
  }
  return [...byId.values()]
}

export const _internal = { mapAdzuna, inferWorkMode, parseYears, relTime, fmtSalary }
