import type { ScoredJob, RoleArchetype, CandidateProfile } from '../types'
import { toConcepts } from './taxonomy'
import { prettyRole } from './scoring'

// ---------------------------------------------------------------------------
// Derived dashboard aggregates. All computed from the scored job set so the
// dashboard stays in sync with the engine automatically.
// ---------------------------------------------------------------------------

export interface DashboardStats {
  total: number
  bestScore: number
  bestJob?: ScoredJob
  naviMumbai: number
  mumbai: number
  strongOrBetter: number
  byRole: { role: RoleArchetype; label: string; jobs: ScoredJob[]; avgScore: number }[]
  missingSkills: { skill: string; count: number }[]
  companies: { company: string; count: number; bestScore: number }[]
}

export function buildDashboard(scored: ScoredJob[], profile: CandidateProfile): DashboardStats {
  const total = scored.length
  const bestJob = scored[0]
  const bestScore = bestJob?.score ?? 0
  const naviMumbai = scored.filter((j) => j.city === 'Navi Mumbai').length
  const mumbai = scored.filter((j) => j.city === 'Mumbai').length
  const strongOrBetter = scored.filter((j) => j.score >= 65).length

  // Group by role archetype, ordered by average fit.
  const roleMap = new Map<RoleArchetype, ScoredJob[]>()
  for (const j of scored) {
    const arr = roleMap.get(j.role) ?? []
    arr.push(j)
    roleMap.set(j.role, arr)
  }
  const byRole = [...roleMap.entries()]
    .map(([role, jobs]) => ({
      role,
      label: labelForRole(role),
      jobs: jobs.sort((a, b) => b.score - a.score),
      avgScore: Math.round(jobs.reduce((a, j) => a + j.score, 0) / jobs.length),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)

  // Skills frequently requested across STRONG-fit jobs but missing from profile.
  const mine = toConcepts([
    ...profile.skills.productAndDelivery,
    ...profile.skills.dataAiTools,
  ])
  const missCount = new Map<string, number>()
  for (const j of scored.filter((x) => x.score >= 55)) {
    for (const s of j.skillMatch.missing) {
      const c = toConcepts([s])
      if ([...c].some((x) => mine.has(x))) continue
      const key = normalizeSkillLabel(s)
      if (!key) continue
      missCount.set(key, (missCount.get(key) ?? 0) + 1)
    }
  }
  const missingSkills = [...missCount.entries()]
    .map(([skill, count]) => ({ skill, count }))
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Companies hiring for matching roles (fit >= moderate), ranked by best score.
  const compMap = new Map<string, { count: number; bestScore: number }>()
  for (const j of scored.filter((x) => x.score >= 45)) {
    const cur = compMap.get(j.company) ?? { count: 0, bestScore: 0 }
    cur.count += 1
    cur.bestScore = Math.max(cur.bestScore, j.score)
    compMap.set(j.company, cur)
  }
  const companies = [...compMap.entries()]
    .map(([company, v]) => ({ company, ...v }))
    .sort((a, b) => b.bestScore - a.bestScore)

  return {
    total,
    bestScore,
    bestJob,
    naviMumbai,
    mumbai,
    strongOrBetter,
    byRole,
    missingSkills,
    companies,
  }
}

function labelForRole(role: RoleArchetype): string {
  const map: Record<RoleArchetype, string> = {
    'technical-pm': 'Technical PM',
    'data-ai-pm': 'Data / AI PM',
    'platform-api-pm': 'Platform / API PM',
    'growth-digital-pm': 'Digital / Growth PM',
    'core-pm': 'Core PM',
    'brand-marketing-pm': 'Brand / Marketing PM',
    'domain-specialist-pm': 'Domain-Specialist PM',
  }
  return map[role]
}

function normalizeSkillLabel(s: string): string {
  const t = s.trim()
  // Drop noise tokens that aren't real skills.
  const noise = ['management', 'senior', 'technical', 'sr', 'pmt', 'min']
  if (noise.includes(t.toLowerCase())) return ''
  return t
}

export { prettyRole }
