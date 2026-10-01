import type { ScoredJob, CandidateProfile, DerivedLevel } from '../types'

// ---------------------------------------------------------------------------
// Apply helpers: identify the target roles (Product Manager / Associate PM) and
// generate tailored application materials from data we already compute. Nothing
// here submits anything — it prepares text for the user to review and send.
// ---------------------------------------------------------------------------

export type TitleLevel = 'APM' | 'PM' | 'other'

/** Classify a posting title into the levels the user is targeting. */
export function titleLevel(title: string): TitleLevel {
  const t = title.toLowerCase()
  if (/associate\s+product\s+manager|\bapm\b/.test(t)) return 'APM'
  if (
    /\bproduct\s+manager\b/.test(t) &&
    !/senior|\bsr\.?\b|group|\bgpm\b|technical|principal|lead|director|head|staff|\bvp\b|chief/.test(t)
  )
    return 'PM'
  return 'other'
}

/** True for Product Manager / Associate Product Manager roles. */
export function isTargetRole(title: string): boolean {
  return titleLevel(title) !== 'other'
}

// ---- Apply preferences (for screening answers) ---------------------------
export interface ApplyPrefs {
  noticePeriod: string
  currentCtc: string
  expectedCtc: string
}
const PREFS_KEY = 'jmp-apply-prefs'
const EMPTY_PREFS: ApplyPrefs = { noticePeriod: '', currentCtc: '', expectedCtc: '' }

export function loadApplyPrefs(): ApplyPrefs {
  try {
    return { ...EMPTY_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }
  } catch {
    return EMPTY_PREFS
  }
}
export function saveApplyPrefs(p: ApplyPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

// ---- Materials generation -------------------------------------------------
export interface GeneratedApplication {
  coverLetter: string
  screening: { q: string; a: string; needsInput?: boolean }[]
}

export function generateApplication(
  job: ScoredJob,
  profile: CandidateProfile,
  level: DerivedLevel,
  prefs: ApplyPrefs,
): GeneratedApplication {
  const matched = job.skillMatch.matched.slice(0, 4)
  const evidence = job.relevantExperience.slice(0, 2)

  const skillLine = matched.length
    ? `My background maps directly to what you need — ${matched.join(', ')}`
    : 'My product background maps well to this role'

  const evidenceLines = evidence.length
    ? ` In particular: ${evidence.join(' ')}`
    : ''

  const coverLetter = [
    `Dear ${job.company} Hiring Team,`,
    '',
    `I'm writing to apply for the ${job.title} position. As a ${level.level} with ${level.totalYears}+ years of experience (${level.productYears} in product), I build real-time data platforms and live-event systems at scale, owning products end to end from discovery through API design to GTM.`,
    '',
    `${skillLine}.${evidenceLines}`,
    '',
    `I'd welcome the chance to discuss how I can contribute to ${job.company}. Thank you for your consideration.`,
    '',
    'Best regards,',
    profile.name,
    profile.email,
  ].join('\n')

  const screening: GeneratedApplication['screening'] = [
    { q: 'Total years of experience', a: `${level.totalYears} years (${level.productYears} in product management)` },
    { q: 'Current location', a: profile.location },
    { q: `Open to working in ${job.city} (${job.workMode})?`, a: 'Yes' },
    { q: 'Notice period', a: prefs.noticePeriod || 'Set in Apply preferences', needsInput: !prefs.noticePeriod },
    { q: 'Current CTC', a: prefs.currentCtc || 'Set in Apply preferences', needsInput: !prefs.currentCtc },
    { q: 'Expected CTC', a: prefs.expectedCtc || 'Set in Apply preferences', needsInput: !prefs.expectedCtc },
    { q: `Why ${job.company}?`, a: whyCompany(job) },
  ]

  return { coverLetter, screening }
}

function whyCompany(job: ScoredJob): string {
  const domainBit: Record<string, string> = {
    'real-time-systems': 'its work on real-time systems, which is exactly where I have delivered at broadcast scale',
    'ott-streaming': 'its OTT/streaming focus, close to my 50M+ concurrent-viewer experience',
    'sports-media': 'its sports & media domain, where I have shipped live event platforms end to end',
    'data-analytics': 'its data & analytics products, matching my analytics and API-product background',
    'ai-llm': 'its AI/LLM direction, which aligns with the LLM products I have built independently',
    'fintech-payments': 'its fintech/payments platform work, adjacent to my real-time transactional systems',
    'api-platform': 'its platform/API focus, directly matching my API product management experience',
  }
  const bit = domainBit[job.domain] || 'the scope of the role and the product problems involved'
  return `I'm drawn to ${job.company} for ${bit}.`
}
