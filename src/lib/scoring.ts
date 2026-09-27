import type {
  CandidateProfile,
  DerivedLevel,
  Job,
  ScoredJob,
  ScoreBreakdown,
  Domain,
  RoleArchetype,
} from '../types'
import { ON_PROFILE_DOMAINS, toConcepts, norm } from './taxonomy'

// ---------------------------------------------------------------------------
// The match engine. A pure function: (job, profile, level) -> ScoredJob.
// Each component returns 0-100; the final score is a weighted sum. Relevance
// (domain + role + skills = 70%) dominates location (15%), so a high-keyword
// but poor-fit job cannot outrank a genuine career fit.
// ---------------------------------------------------------------------------

export const WEIGHTS: ScoreBreakdown = {
  domain: 25,
  role: 20,
  skills: 25,
  experience: 15,
  location: 15,
}

// PM competencies that signal a genuine role fit — weighted above tool keywords.
const CORE_PM_CONCEPTS = [
  'product management',
  'product strategy',
  'roadmap',
  'gtm',
  'api product management',
  'real time systems',
  'analytics',
  'stakeholder management',
  'a b testing',
  'user research',
]

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

// ---- Domain fit ----------------------------------------------------------
function scoreDomain(job: Job, profile: CandidateProfile): number {
  const idx = profile.domains.indexOf(job.domain)
  if (idx !== -1) {
    // Rank 0 (strongest domain) -> 100, decaying gently down the list.
    return clamp(100 - idx * 8)
  }
  // Adjacent-but-not-core on-profile domain still gets partial credit.
  if (ON_PROFILE_DOMAINS.includes(job.domain)) return 60
  // Off-profile domains (pharma, insurance, FMCG, generic banking).
  return job.domain === 'ecommerce-consumer' ? 35 : 18
}

// ---- Role & seniority fit ------------------------------------------------
const ROLE_BASE: Record<RoleArchetype, number> = {
  'technical-pm': 92,
  'data-ai-pm': 95,
  'platform-api-pm': 96,
  'growth-digital-pm': 70,
  'core-pm': 62,
  'brand-marketing-pm': 28,
  'domain-specialist-pm': 22,
}

function scoreRole(job: Job, level: DerivedLevel): number {
  let s = ROLE_BASE[job.role]
  // Seniority alignment: nudge up when the posting's band brackets the
  // candidate's target band, down when it's far junior or far senior.
  const mid = (job.expMin + job.expMax) / 2
  const targetMid = (level.targetBand.min + level.targetBand.max) / 2
  const gap = Math.abs(mid - targetMid)
  if (gap <= 2) s += 4
  else if (gap >= 6) s -= 12
  return clamp(s)
}

// ---- Skills overlap ------------------------------------------------------
function scoreSkills(
  job: Job,
  profile: CandidateProfile,
): { score: number; matched: string[]; missing: string[] } {
  const mine = toConcepts([
    ...profile.skills.productAndDelivery,
    ...profile.skills.dataAiTools,
  ])
  const matched: string[] = []
  const missing: string[] = []
  let weightHit = 0
  let weightTotal = 0

  for (const raw of job.requiredSkills) {
    const concept = toConcepts([raw])
    const isCore = [...concept].some((c) => CORE_PM_CONCEPTS.includes(c))
    const w = isCore ? 2 : 1
    weightTotal += w
    const hit = [...concept].some((c) => mine.has(c))
    if (hit) {
      matched.push(raw)
      weightHit += w
    } else {
      missing.push(raw)
    }
  }
  const score = weightTotal === 0 ? 50 : clamp((weightHit / weightTotal) * 100)
  return { score, matched, missing }
}

// ---- Experience-level fit ------------------------------------------------
function scoreExperience(job: Job, level: DerivedLevel): number {
  const { min, max } = level.targetBand
  // Overlap between candidate target band and the posting's requested band.
  const overlap = Math.max(0, Math.min(max, job.expMax) - Math.max(min, job.expMin))
  const span = Math.max(1, job.expMax - job.expMin)
  let s = 40 + (overlap / span) * 60
  // Penalize postings demanding well beyond the candidate's ceiling.
  if (job.expMin > max + 1) s -= (job.expMin - max) * 10
  // Slightly penalize very junior postings (under-leveled).
  if (job.expMax < min) s -= (min - job.expMax) * 12
  return clamp(s)
}

// ---- Location & work mode ------------------------------------------------
function scoreLocation(job: Job): number {
  // Navi Mumbai is the top priority; Mumbai second. Both work modes are valid.
  let s = job.city === 'Navi Mumbai' ? 100 : 84
  if (job.workMode === 'Hybrid') s += 0 // both hybrid & on-site are acceptable
  return clamp(s)
}

// ---- Explanations --------------------------------------------------------
function buildReasons(
  job: Job,
  b: ScoreBreakdown,
  skillMatch: { matched: string[]; missing: string[] },
): string[] {
  const r: string[] = []
  const dl = (n: number) => (n >= 80 ? 'strong' : n >= 55 ? 'moderate' : 'limited')

  r.push(
    `${dl(b.domain)} domain fit — ${prettyDomain(job.domain)} aligns with your real-time/data/live-event background.`,
  )
  r.push(`${dl(b.role)} role fit — ${prettyRole(job.role)}.`)
  if (skillMatch.matched.length)
    r.push(
      `Skill overlap on ${skillMatch.matched.slice(0, 5).join(', ')}${
        skillMatch.matched.length > 5 ? '…' : ''
      }.`,
    )
  if (b.experience >= 70)
    r.push(`Experience band (${job.expMin}–${job.expMax} yrs) sits well against your profile.`)
  else if (job.expMin > 10)
    r.push(`Posting targets ${job.expMin}+ yrs — more senior than your current band.`)
  r.push(
    job.city === 'Navi Mumbai'
      ? 'Located in Navi Mumbai — your top-priority location.'
      : 'Located in Mumbai — your second-priority location.',
  )
  return r
}

function pickEvidence(job: Job, profile: CandidateProfile): string[] {
  const wanted = new Set<string>([job.domain])
  // pull in themes implied by the role archetype
  if (job.role === 'data-ai-pm') {
    wanted.add('data-analytics')
    wanted.add('ai-llm')
  }
  if (job.role === 'platform-api-pm') wanted.add('api-platform')
  if (job.role === 'technical-pm') wanted.add('real-time-systems')

  const scored = profile.evidence
    .map((e) => ({
      e,
      hits: (e.themes as string[]).filter((t) => wanted.has(t)).length,
    }))
    .sort((a, b) => b.hits - a.hits)

  const picked = scored.filter((s) => s.hits > 0).slice(0, 3)
  const result = (picked.length ? picked : scored.slice(0, 2)).map((s) => s.e.text)
  return result
}

function seniorityFitText(job: Job, level: DerivedLevel): string {
  const mid = (job.expMin + job.expMax) / 2
  const targetMid = (level.targetBand.min + level.targetBand.max) / 2
  if (Math.abs(mid - targetMid) <= 2)
    return `Well aligned with your derived level (${level.level}).`
  if (mid > targetMid)
    return `Leans senior of your current band — a stretch/step-up opportunity.`
  return `Slightly junior of your band — likely an easy clear on seniority.`
}

export function prettyDomain(d: Domain): string {
  const map: Record<Domain, string> = {
    'real-time-systems': 'Real-time systems',
    'ott-streaming': 'OTT / streaming',
    'sports-media': 'Sports & media',
    'data-analytics': 'Data & analytics',
    'ai-llm': 'AI / LLM',
    'fintech-payments': 'Fintech & payments',
    'api-platform': 'API / platform',
    'ecommerce-consumer': 'E-commerce / consumer',
    'pharma-healthcare': 'Pharma / healthcare',
    'banking-lending': 'Banking / lending',
    insurance: 'Insurance',
    'manufacturing-fmcg': 'Manufacturing / FMCG',
    other: 'Other',
  }
  return map[d]
}

export function prettyRole(r: RoleArchetype): string {
  const map: Record<RoleArchetype, string> = {
    'technical-pm': 'a technical PM role close to your engineering-facing work',
    'data-ai-pm': 'a data/AI PM role matching your analytics & LLM product work',
    'platform-api-pm': 'a platform/API PM role matching your API product management',
    'growth-digital-pm': 'a digital/growth PM role using your GTM & experimentation skills',
    'core-pm': 'a general PM role',
    'brand-marketing-pm': 'a brand/marketing PM role, away from your technical strengths',
    'domain-specialist-pm': 'a domain-specialist PM role requiring different sector expertise',
  }
  return map[r]
}

function tierFor(score: number): ScoredJob['tier'] {
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Strong'
  if (score >= 45) return 'Moderate'
  return 'Weak'
}

export function scoreJob(
  job: Job,
  profile: CandidateProfile,
  level: DerivedLevel,
): ScoredJob {
  const skills = scoreSkills(job, profile)
  const breakdown: ScoreBreakdown = {
    domain: scoreDomain(job, profile),
    role: scoreRole(job, level),
    skills: skills.score,
    experience: scoreExperience(job, level),
    location: scoreLocation(job),
  }

  const contributions: ScoreBreakdown = {
    domain: (breakdown.domain * WEIGHTS.domain) / 100,
    role: (breakdown.role * WEIGHTS.role) / 100,
    skills: (breakdown.skills * WEIGHTS.skills) / 100,
    experience: (breakdown.experience * WEIGHTS.experience) / 100,
    location: (breakdown.location * WEIGHTS.location) / 100,
  }

  const score = clamp(
    contributions.domain +
      contributions.role +
      contributions.skills +
      contributions.experience +
      contributions.location,
  )

  return {
    ...job,
    score,
    breakdown,
    contributions,
    reasons: buildReasons(job, breakdown, skills),
    relevantExperience: pickEvidence(job, profile),
    skillMatch: { matched: skills.matched, missing: skills.missing },
    seniorityFit: seniorityFitText(job, level),
    tier: tierFor(score),
  }
}

/** Score & rank all jobs. Primary sort = career fit; ties broken by location
 *  priority (Navi Mumbai before Mumbai), matching the product ranking rule. */
export function rankJobs(
  jobs: Job[],
  profile: CandidateProfile,
  level: DerivedLevel,
): ScoredJob[] {
  return jobs
    .map((j) => scoreJob(j, profile, level))
    .sort((a, b) => {
      if (Math.abs(b.score - a.score) > 3) return b.score - a.score
      // Within a similar-fit band, Navi Mumbai wins.
      const cityRank = (c: string) => (c === 'Navi Mumbai' ? 0 : 1)
      if (cityRank(a.city) !== cityRank(b.city)) return cityRank(a.city) - cityRank(b.city)
      return b.score - a.score
    })
}

export { norm }
