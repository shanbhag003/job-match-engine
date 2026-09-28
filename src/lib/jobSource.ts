import type { Job } from '../types'
import { jobs as staticJobs } from '../data/jobs'

// ---------------------------------------------------------------------------
// JobSource abstraction. The whole engine depends only on this interface, so a
// live feed can replace the baked-in data without touching the scorer or UI.
// ---------------------------------------------------------------------------

/** Result of a fetch, carrying feed freshness metadata for the UI. */
export interface JobFeedResult {
  jobs: Job[]
  /** ISO timestamp the data was generated, when known. */
  generatedAt: string | null
  /** true when served from the live scraper feed; false for baked-in data. */
  live: boolean
}

export interface JobSource {
  readonly id: string
  readonly label: string
  fetchJobs(): Promise<JobFeedResult>
}

// Titles we drop: engineering / individual-contributor technical roles (Python
// dev, ML engineer, data scientist, QA, architect…) AND sales roles.
const EXCLUDE_TITLE =
  /\b(developer|engineer|engineering|programmer|sde|sdet|architect|dev\s?ops|qa|tester|data scientist|machine learning|ml engineer|full[-\s]?stack|front[-\s]?end|back[-\s]?end|java|python|react|angular|\.net|node\.?js|golang|android|ios|sales|business development|\bbd\b|pre[-\s]?sales|account manager|relationship manager|territory manager)\b/i
// Titles that are unambiguously product roles — always kept, even if the line
// also mentions a technical or sales word (e.g. "AI Technical Product Manager").
const PRODUCT_TITLE = /product\s*(manager|owner|lead|management)|\b(a?pm|gpm)\b/i

/** Keep product roles; drop developer/engineer/IC-technical and sales roles. */
export const isProductRole = (title: string): boolean =>
  PRODUCT_TITLE.test(title) || !EXCLUDE_TITLE.test(title)

const allowed = (j: Job) =>
  (j.city === 'Navi Mumbai' || j.city === 'Mumbai') &&
  (j.workMode === 'On-site' || j.workMode === 'Hybrid') &&
  isProductRole(j.title)

/** The date the baked-in listings were captured (latest capturedOn present). */
function staticCapturedOn(): string | null {
  const dates = staticJobs.map((j) => j.capturedOn).filter(Boolean).sort()
  return dates.length ? dates[dates.length - 1] : null
}

/** Baked-in real listings captured from Naukri.com. Always available offline. */
export class StaticJobSource implements JobSource {
  readonly id = 'naukri-static'
  readonly label = 'Naukri.com (captured listings)'
  async fetchJobs(): Promise<JobFeedResult> {
    return { jobs: staticJobs.filter(allowed), generatedAt: staticCapturedOn(), live: false }
  }
}

/**
 * Live feed produced by the backend scraper (see /backend). Fetches jobs.json
 * from `feedUrl` and falls back to the static data if the feed is unreachable —
 * so the deployed app never shows an empty state.
 */
export class FetchJobSource implements JobSource {
  readonly id = 'naukri-feed'
  readonly label = 'Naukri.com (live hourly feed)'
  constructor(private feedUrl: string) {}
  async fetchJobs(): Promise<JobFeedResult> {
    try {
      const res = await fetch(this.feedUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error(`feed ${res.status}`)
      const data = (await res.json()) as { jobs?: Job[]; generatedAt?: string }
      const jobs = Array.isArray(data.jobs) ? data.jobs.filter(allowed) : []
      if (!jobs.length) throw new Error('empty feed')
      return { jobs, generatedAt: data.generatedAt ?? null, live: true }
    } catch (e) {
      console.warn('[jobSource] live feed unavailable, using baked-in data:', e)
      return { jobs: staticJobs.filter(allowed), generatedAt: staticCapturedOn(), live: false }
    }
  }
}

// Configure a live feed at build time with VITE_JOBS_FEED_URL (e.g. the backend
// server's https URL). When unset — as on the shared static Artifact — the app
// uses the baked-in listings.
const feedUrl = import.meta.env.VITE_JOBS_FEED_URL as string | undefined

export const activeSource: JobSource = feedUrl
  ? new FetchJobSource(feedUrl)
  : new StaticJobSource()
