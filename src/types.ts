// ---------------------------------------------------------------------------
// Core domain types for the personalized job recommendation engine.
// The candidate profile is the single source of truth; jobs are scored
// against it. Everything downstream (scoring, UI) depends only on these types.
// ---------------------------------------------------------------------------

/** Broad domains the candidate has real depth in. Jobs are tagged with these
 *  so domain fit can be scored against lived experience, not keywords. */
export type Domain =
  | 'real-time-systems'
  | 'ott-streaming'
  | 'sports-media'
  | 'data-analytics'
  | 'ai-llm'
  | 'fintech-payments'
  | 'api-platform'
  | 'ecommerce-consumer'
  // Off-profile domains kept so the engine can correctly *down-rank* them:
  | 'pharma-healthcare'
  | 'banking-lending'
  | 'insurance'
  | 'manufacturing-fmcg'
  | 'other'

export type WorkMode = 'On-site' | 'Hybrid' // Remote is excluded by product rule.

export type City = 'Navi Mumbai' | 'Mumbai'

/** The kind of PM role, used for role-fit scoring. Technical/data/platform/API
 *  PM roles fit the candidate; brand/marketing/domain-sales PM roles do not. */
export type RoleArchetype =
  | 'technical-pm'
  | 'data-ai-pm'
  | 'platform-api-pm'
  | 'growth-digital-pm'
  | 'core-pm'
  | 'brand-marketing-pm'
  | 'domain-specialist-pm'

export interface ExperienceSignal {
  /** Human-readable seniority signal derived from the résumé. */
  label: string
  /** Weight this signal contributes to the derived seniority score. */
  weight: number
}

export interface ResumeEvidence {
  /** Theme tag so a job can pull the most relevant proof points. */
  themes: Domain[] | ThemeTag[]
  text: string
}

export type ThemeTag =
  | 'real-time-systems'
  | 'ott-streaming'
  | 'sports-media'
  | 'data-analytics'
  | 'ai-llm'
  | 'fintech-payments'
  | 'api-platform'
  | 'leadership'
  | 'gtm'
  | 'delivery'

export interface CandidateProfile {
  name: string
  headline: string
  location: string
  email: string
  summary: string
  /** Employment spans used to derive total & PM-specific years. */
  timeline: {
    role: string
    org: string
    start: string // ISO-ish 'YYYY-MM'
    end: string | 'present'
    isProductRole: boolean
  }[]
  /** Weighted seniority signals; the derived level is computed from these. */
  senioritySignals: ExperienceSignal[]
  /** Canonical skills grouped by category. Names are matched via taxonomy. */
  skills: {
    productAndDelivery: string[]
    dataAiTools: string[]
  }
  /** Domains the candidate has genuine depth in, strongest first. */
  domains: Domain[]
  /** Proof points, tagged, surfaced as "relevant experience" per job. */
  evidence: ResumeEvidence[]
  education: string[]
  links: { label: string; note: string }[]
}

/** A job as ingested from a source (before scoring). */
export interface Job {
  id: string
  title: string
  company: string
  city: City
  /** Raw location string as listed (e.g. "Hybrid - Mumbai (All Areas)"). */
  locationRaw: string
  workMode: WorkMode
  /** Inferred min/max years of experience the posting asks for. */
  expMin: number
  expMax: number
  domain: Domain
  role: RoleArchetype
  /** Skills/keywords listed on the posting. */
  requiredSkills: string[]
  /** One-line description snippet from the posting. */
  summary: string
  /** Direct apply link (real listing URL). */
  applyUrl: string
  salary?: string
  postedRelative?: string
  source: string
  capturedOn: string // ISO date the listing was captured
}

/** Per-component breakdown of a match score, for explainability. */
export interface ScoreBreakdown {
  domain: number
  role: number
  skills: number
  experience: number
  location: number
}

export interface SkillMatch {
  matched: string[]
  missing: string[]
}

/** A job after scoring against the candidate profile. */
export interface ScoredJob extends Job {
  score: number
  breakdown: ScoreBreakdown
  /** Weighted contribution of each component to the final 0-100 score. */
  contributions: ScoreBreakdown
  reasons: string[]
  relevantExperience: string[]
  skillMatch: SkillMatch
  seniorityFit: string
  /** Bucketed label for UI. */
  tier: 'Excellent' | 'Strong' | 'Moderate' | 'Weak'
}

export interface DerivedLevel {
  level: string
  totalYears: number
  productYears: number
  rationale: string[]
  /** Target experience band (years) used for experience-fit scoring. */
  targetBand: { min: number; max: number }
}
