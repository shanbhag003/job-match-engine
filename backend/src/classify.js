// ---------------------------------------------------------------------------
// Pure normalization: a Naukri jobapi `jobDetails` record -> the app's Job
// schema (same shape as src/data/jobs.ts). Also classifies domain & role so
// the frontend scorer can rank without any Naukri-specific knowledge.
// This module is dependency-free and unit-testable in isolation.
// ---------------------------------------------------------------------------

const DOMAIN_KEYWORDS = {
  'ott-streaming': ['ott', 'streaming', 'jiocinema', 'sonyliv', 'hotstar', 'content viewership', 'broadcast'],
  'sports-media': ['sports', 'media', 'live event', 'gaming', 'fantasy'],
  'real-time-systems': ['real time', 'real-time', 'live data', 'low latency', 'iot', 'trading platform', 'mobile trading'],
  'ai-llm': ['generative ai', ' ai ', 'llm', 'agentic', 'machine learning', ' ml ', 'conversational', 'copilot'],
  'data-analytics': ['analytics', 'business intelligence', 'data platform', 'data engineering', 'big data', 'reference data', ' data '],
  'api-platform': [' api', 'platform', 'sdk', 'developer', 'integration', 'infrastructure'],
  'fintech-payments': ['fintech', 'payments', 'lending', 'banking', 'broking', 'capital markets', 'nbfc', 'fastag', 'crypto', 'trading'],
  'ecommerce-consumer': ['ecommerce', 'e-commerce', 'd2c', 'consumer', 'retail', 'marketplace', 'fmcg', 'cookware'],
  'pharma-healthcare': ['pharma', 'pharmaceutical', 'healthcare', 'clinical', 'neurology', 'cardio', 'cns', 'medicine', 'revenue cycle'],
  'banking-lending': ['loan', 'credit', 'liquidity', 'equipment finance', 'working capital'],
  insurance: ['insurance', 'motor insurance', 'claims', 'underwriting', 'lombard'],
  'manufacturing-fmcg': ['paints', 'lighting', 'consumer durables', 'manufacturing', 'supply chain', 'packaging'],
}

// Domains considered on-profile, checked in priority order.
const DOMAIN_ORDER = [
  'ott-streaming', 'sports-media', 'real-time-systems', 'ai-llm', 'data-analytics',
  'api-platform', 'fintech-payments', 'ecommerce-consumer', 'pharma-healthcare',
  'banking-lending', 'insurance', 'manufacturing-fmcg',
]

export function classifyDomain(text) {
  const t = ` ${text.toLowerCase()} `
  for (const d of DOMAIN_ORDER) {
    if ((DOMAIN_KEYWORDS[d] || []).some((k) => t.includes(k))) return d
  }
  return 'other'
}

export function classifyRole(title, skills, jd) {
  const t = `${title} ${skills} ${jd}`.toLowerCase()
  if (/\b(brand|marketing manager|promotions|advertising)\b/.test(t) && /pharma|fmcg|paint/.test(t))
    return 'brand-marketing-pm'
  if (/pharma|neurology|cardio|cns|motor insurance|revenue cycle|healthcare/.test(t))
    return 'domain-specialist-pm'
  if (/data|analytics|machine learning|\bai\b|llm|generative|agentic/.test(t)) return 'data-ai-pm'
  if (/\bapi\b|platform|sdk|infrastructure|integration|payments|crypto/.test(t)) return 'platform-api-pm'
  if (/technical|engineering|software|technology product/.test(t)) return 'technical-pm'
  if (/digital|growth|d2c|ecommerce|ux/.test(t)) return 'growth-digital-pm'
  return 'core-pm'
}

export function parseExp(label) {
  // "3-8 Yrs" -> {min:3,max:8}
  const m = (label || '').match(/(\d+)\s*-\s*(\d+)/)
  if (m) return { min: Number(m[1]), max: Number(m[2]) }
  const single = (label || '').match(/(\d+)/)
  return single ? { min: Number(single[1]), max: Number(single[1]) + 3 } : { min: 0, max: 5 }
}

export function classifyCity(locationLabel) {
  const l = (locationLabel || '').toLowerCase()
  if (l.includes('navi mumbai')) return 'Navi Mumbai'
  if (l.includes('mumbai')) return 'Mumbai'
  return null // outside the allowed locations -> caller drops it
}

// Titles we exclude: engineering / IC-technical roles AND sales roles.
const EXCLUDE_TITLE =
  /\b(developer|engineer|engineering|programmer|sde|sdet|architect|dev\s?ops|qa|tester|data scientist|machine learning|ml engineer|full[-\s]?stack|front[-\s]?end|back[-\s]?end|java|python|react|angular|\.net|node\.?js|golang|android|ios|sales|business development|\bbd\b|pre[-\s]?sales|account manager|relationship manager|territory manager)\b/i
const PRODUCT_TITLE =
  /\bproduct\s+(manager|owner|management|lead|director|head)\b|\b(a?pm|gpm|cpo)\b|\b(director|head|vp|chief)\s+(of\s+)?product\b/i

/** Lenient: keep genuine product roles; drop developer/engineer/IC-technical
 *  and sales roles. Used for already-category-filtered sources (Naukri). A real
 *  "Product Manager" title always wins over a technical/sales word elsewhere. */
export function isProductRole(title) {
  return PRODUCT_TITLE.test(title) || !EXCLUDE_TITLE.test(title)
}

/** Strict: the title must itself be a product role. Used for broad keyword
 *  aggregators (Adzuna, Google-for-Jobs) whose searches return lots of
 *  loosely-related roles. */
export function isStrictProductRole(title) {
  return PRODUCT_TITLE.test(title) && !EXCLUDE_TITLE.test(title)
}

/**
 * @param {object} jd  A Naukri jobapi jobDetails record.
 * @param {{workMode: 'On-site'|'Hybrid'}} ctx
 * @returns {object|null} A Job, or null if it should be dropped.
 */
export function normalize(jd, ctx) {
  const ph = Object.fromEntries((jd.placeholders || []).map((p) => [p.type, p.label]))
  const city = classifyCity(ph.location)
  if (!city) return null
  if (!isProductRole(jd.title || '')) return null // drop developer/engineer roles

  const skills = (jd.tagsAndSkills || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const jdText = (jd.jobDescription || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const classText = `${jd.title} ${skills.join(' ')} ${jdText}`
  const exp = parseExp(ph.experience)
  const salary = ph.salary && !/not disclosed/i.test(ph.salary) ? ph.salary : undefined

  return {
    id: String(jd.jobId),
    title: jd.title,
    company: jd.companyName,
    city,
    locationRaw: ph.location || city,
    workMode: ctx.workMode,
    expMin: exp.min,
    expMax: exp.max,
    domain: classifyDomain(classText),
    role: classifyRole(jd.title, skills.join(' '), jdText),
    requiredSkills: skills.slice(0, 12),
    summary: jdText.slice(0, 240) || jd.title,
    applyUrl: jd.jdURL ? `https://www.naukri.com${jd.jdURL}` : 'https://www.naukri.com',
    salary,
    postedRelative: jd.footerPlaceholderLabel,
    source: 'Naukri.com',
    capturedOn: new Date().toISOString().slice(0, 10),
  }
}

export const _internal = { classifyDomain, classifyRole, parseExp, classifyCity }
