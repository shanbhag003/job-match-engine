// ---------------------------------------------------------------------------
// Shared helpers for source adapters (Adzuna, SerpApi Google-for-Jobs, …):
// text cleanup, work-mode / experience / skills / salary / date parsing.
// ---------------------------------------------------------------------------

export const stripHtml = (s = '') =>
  s.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const SKILL_VOCAB = [
  'product management', 'product strategy', 'roadmap', 'gtm', 'go-to-market', 'api',
  'sql', 'analytics', 'agile', 'scrum', 'stakeholder', 'a/b testing', 'user research',
  'python', 'tableau', 'power bi', 'machine learning', 'llm', 'generative ai', 'data',
  'fintech', 'payments', 'discovery', 'okr', 'kpi', 'jira', 'figma', 'prd', 'wireframing',
]

/** 'Hybrid' | 'On-site', or null to drop a Remote posting. */
export function inferWorkMode(text) {
  const t = text.toLowerCase()
  if ((/\bremote\b|work from home|\bwfh\b/.test(t)) && !/hybrid/.test(t)) return null
  if (/hybrid/.test(t)) return 'Hybrid'
  return 'On-site'
}

/** Best-effort {min,max} years from free text, with sanity bounds. */
export function parseYears(desc) {
  const m = desc.match(/(\d+)\s*(?:\+|to|-|–)?\s*(\d+)?\s*\+?\s*years?/i)
  if (m) {
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a + 3
    if (a <= 25 && b <= 30) return { min: a, max: Math.max(a, b) }
  }
  return { min: 3, max: 8 } // neutral default when unstated / implausible
}

export function extractSkills(text) {
  const t = text.toLowerCase()
  const found = []
  for (const s of SKILL_VOCAB) if (t.includes(s) && !found.includes(s)) found.push(s)
  return found.slice(0, 10).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase()))
}

/** Format an INR annual min/max into an approximate "x-y LPA" label. */
export function fmtSalary(min, max) {
  if (!min && !max) return undefined
  const lpa = (v) => Math.round((v / 100000) * 10) / 10
  if (min && max) return `${lpa(min)}-${lpa(max)} LPA`
  return `${lpa(min || max)} LPA`
}

/** Turn an ISO timestamp into a Naukri-style relative label the scorer parses. */
export function relTime(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return undefined
  const days = Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000))
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  if (days <= 28) return `${Math.round(days / 7)} week${days >= 14 ? 's' : ''} ago`
  return '30+ days ago'
}
