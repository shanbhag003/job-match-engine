import type { CandidateProfile, DerivedLevel } from '../types'

// ---------------------------------------------------------------------------
// Experience-level derivation. NEVER hardcoded — computed from the résumé's
// employment timeline plus weighted seniority signals. If the résumé changes,
// the level, rationale and target band all change with it.
// ---------------------------------------------------------------------------

function monthsBetween(start: string, end: string): number {
  const [sy, sm] = start.split('-').map(Number)
  const now = new Date()
  const [ey, em] =
    end === 'present' ? [now.getFullYear(), now.getMonth() + 1] : end.split('-').map(Number)
  return (ey - sy) * 12 + (em - sm)
}

export function deriveLevel(profile: CandidateProfile): DerivedLevel {
  const totalMonths = profile.timeline.reduce(
    (acc, t) => acc + monthsBetween(t.start, t.end),
    0,
  )
  const productMonths = profile.timeline
    .filter((t) => t.isProductRole)
    .reduce((acc, t) => acc + monthsBetween(t.start, t.end), 0)

  const totalYears = Math.round((totalMonths / 12) * 10) / 10
  const productYears = Math.round((productMonths / 12) * 10) / 10

  const rawSignalScore = profile.senioritySignals.reduce((acc, s) => acc + s.weight, 0)
  // Cap the scope contribution so a keyword-dense résumé can't inflate seniority;
  // real tenure (productYears) remains the primary driver of higher bands.
  const signalScore = Math.min(16, rawSignalScore)

  // Combine tenure with demonstrated scope. Product tenure counts double toward
  // seniority; scope signals push a candidate up a band beyond raw years.
  const seniorityIndex = productYears * 2 + totalYears * 0.5 + signalScore

  let level: string
  let targetBand: { min: number; max: number }
  const rationale: string[] = []

  if (seniorityIndex >= 32) {
    level = 'Group / Principal Product Manager'
    targetBand = { min: 9, max: 15 }
  } else if (seniorityIndex >= 22) {
    level = 'Senior Product Manager'
    targetBand = { min: 5, max: 10 }
  } else if (seniorityIndex >= 12) {
    level = 'Product Manager'
    targetBand = { min: 3, max: 7 }
  } else {
    level = 'Associate Product Manager'
    targetBand = { min: 0, max: 4 }
  }

  rationale.push(
    `${totalYears} yrs total experience, ${productYears} yrs in product roles.`,
  )
  rationale.push(
    `${profile.senioritySignals.length} seniority signals detected (scope score ${signalScore}), e.g. "${profile.senioritySignals[0].label}".`,
  )
  rationale.push(
    `Seniority index ${Math.round(seniorityIndex)} → ${level} (target band ${targetBand.min}–${targetBand.max} yrs).`,
  )

  return { level, totalYears, productYears, rationale, targetBand }
}
