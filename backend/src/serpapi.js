import { classifyDomain, classifyRole, classifyCity, isStrictProductRole } from './classify.js'
import { KEYWORDS } from './queries.js'
import { stripHtml, sleep, inferWorkMode, parseYears, extractSkills } from './util.js'

// ---------------------------------------------------------------------------
// SerpApi Google-for-Jobs adapter. Google for Jobs aggregates many boards
// (LinkedIn, company career pages, Indeed, Foundit, …), so one query yields
// broad coverage. Each posting's `source` is set to the underlying board (the
// Google "via …" value), so you can see where it actually came from.
//
// Needs a SerpApi key (https://serpapi.com, free tier ~100 searches/mo) in env
// SERPAPI_KEY. If unset, it's skipped gracefully.
// ---------------------------------------------------------------------------

// Cities to search (Navi Mumbai priority, then Mumbai). Google-for-Jobs takes a
// free-text location; we still classify per posting and drop anything else.
const LOCATIONS = ['Navi Mumbai, Maharashtra, India', 'Mumbai, Maharashtra, India']

function cleanVia(via) {
  // "via LinkedIn" -> "LinkedIn"; fall back to "Google Jobs".
  const s = (via || '').replace(/^via\s+/i, '').trim()
  return s || 'Google Jobs'
}

function firstApplyLink(r) {
  if (Array.isArray(r.apply_options) && r.apply_options.length) return r.apply_options[0].link
  return r.related_links?.[0]?.link || 'https://www.google.com/search?q=' + encodeURIComponent(r.title || '')
}

function mapSerp(r) {
  const title = stripHtml(r.title || '')
  if (!isStrictProductRole(title)) return null
  const loc = r.location || ''
  const city = classifyCity(loc)
  if (!city) return null

  const ext = r.detected_extensions || {}
  const desc = stripHtml(r.description || '')
  // Prefer Google's explicit remote flag, else infer from text.
  if (ext.work_from_home === true && !/hybrid/i.test(`${title} ${desc}`)) return null
  const workMode = inferWorkMode(`${title} ${desc} ${ext.schedule_type || ''}`)
  if (!workMode) return null

  const exp = parseYears(desc)
  return {
    id: `serp-${r.job_id ? r.job_id.slice(0, 24) : Math.random().toString(36).slice(2)}`,
    title,
    company: r.company_name || 'Undisclosed',
    city,
    locationRaw: loc || city,
    workMode,
    expMin: exp.min,
    expMax: exp.max,
    domain: classifyDomain(`${title} ${desc}`),
    role: classifyRole(title, '', desc),
    requiredSkills: extractSkills(`${title} ${desc}`),
    summary: desc.slice(0, 240) || title,
    applyUrl: firstApplyLink(r),
    salary: ext.salary || undefined,
    postedRelative: ext.posted_at, // already a relative label e.g. "3 days ago"
    source: cleanVia(r.via), // the underlying board: LinkedIn / company / …
    capturedOn: new Date().toISOString().slice(0, 10),
  }
}

/** Fetch product roles via SerpApi's Google-for-Jobs engine. */
export async function fetchSerpJobs({
  apiKey = process.env.SERPAPI_KEY,
  log = console.log,
} = {}) {
  if (!apiKey) {
    log('[serpapi] SERPAPI_KEY not set — skipping Google-for-Jobs source')
    return []
  }
  const byId = new Map()
  for (const keyword of KEYWORDS) {
    for (const location of LOCATIONS) {
      const url =
        `https://serpapi.com/search.json?engine=google_jobs&hl=en&gl=in` +
        `&q=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}` +
        `&api_key=${apiKey}`
      try {
        const res = await fetch(url)
        if (!res.ok) {
          log(`  ! serpapi ${keyword} / ${location.split(',')[0]}: HTTP ${res.status}`)
          continue
        }
        const data = await res.json()
        let added = 0
        for (const r of data.jobs_results || []) {
          const job = mapSerp(r)
          if (job && !byId.has(job.id)) {
            byId.set(job.id, job)
            added++
          }
        }
        log(`  ✓ serpapi ${keyword} / ${location.split(',')[0]}: +${added} (total ${byId.size})`)
      } catch (e) {
        log(`  ! serpapi ${keyword} / ${location.split(',')[0]}: ${e.message}`)
      }
      await sleep(500) // gentle pacing; SerpApi also rate-limits
    }
  }
  return [...byId.values()]
}

export const _internal = { mapSerp, cleanVia }
