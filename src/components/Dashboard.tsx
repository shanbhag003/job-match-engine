import type { ScoredJob, DerivedLevel } from '../types'
import type { DashboardStats } from '../lib/dashboard'
import JobCard from './JobCard'

interface Props {
  stats: DashboardStats
  level: DerivedLevel
  applied: Record<string, { appliedOn: string }>
  onOpen: (job: ScoredJob) => void
  onHide: (id: string) => void
  onSeeAll: () => void
}

export default function Dashboard({ stats, level, applied, onOpen, onHide, onSeeAll }: Props) {
  return (
    <div className="space-y-8">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Best match score"
          value={`${stats.bestScore}`}
          sub={stats.bestJob ? `${stats.bestJob.company}` : ''}
          accent="emerald"
        />
        <StatTile
          label="Strong+ matches"
          value={`${stats.strongOrBetter}`}
          sub={`of ${stats.total} roles`}
          accent="brand"
        />
        <StatTile
          label="Navi Mumbai"
          value={`${stats.naviMumbai}`}
          sub="top-priority location"
          accent="indigo"
        />
        <StatTile label="Mumbai" value={`${stats.mumbai}`} sub="second priority" accent="slate" />
      </div>

      {/* Top recommendations */}
      <section>
        <SectionHeader
          title="Top job recommendations"
          action={{ label: 'See all matches →', onClick: onSeeAll }}
        />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {stats.bestJob &&
            [stats.bestJob, ...topAfterBest(stats)].slice(0, 6).map((j, i) => (
              <JobCard key={j.id} job={j} rank={i + 1} applied={!!applied[j.id]} onOpen={onOpen} onHide={onHide} />
            ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Roles grouped */}
        <section className="lg:col-span-2">
          <SectionHeader title="Jobs grouped by role category" />
          <div className="space-y-3">
            {stats.byRole.map((g) => (
              <div
                key={g.role}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{g.label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                      {g.jobs.length}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">avg fit {g.avgScore}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.jobs.slice(0, 6).map((j) => (
                    <button
                      key={j.id}
                      onClick={() => onOpen(j)}
                      className="group flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: scoreColor(j.score) }}
                      />
                      {j.company}
                      {applied[j.id] && <span className="text-emerald-500">✓</span>}
                      <span className="tabular-nums text-slate-400">{j.score}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sidebar: missing skills + companies */}
        <div className="space-y-6">
          <section>
            <SectionHeader title="Skills to add" />
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="mb-3 text-xs text-slate-400">
                Frequently requested across your good-fit roles but not on your résumé.
              </p>
              {stats.missingSkills.length ? (
                <ul className="space-y-2">
                  {stats.missingSkills.map((s) => (
                    <li key={s.skill} className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{
                            width: `${(s.count / stats.missingSkills[0].count) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-40 truncate text-sm text-slate-600 dark:text-slate-300">
                        {s.skill}
                      </span>
                      <span className="tabular-nums text-xs text-slate-400">{s.count}×</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No recurring gaps — your skills cover the field.</p>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="Companies hiring for your profile" />
            <div className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/60">
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {stats.companies.slice(0, 10).map((c) => (
                  <li key={c.company} className="flex items-center justify-between gap-2 px-2 py-2">
                    <span className="truncate text-sm text-slate-700 dark:text-slate-200">
                      {c.company}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {c.count > 1 && (
                        <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                          {c.count} roles
                        </span>
                      )}
                      <span
                        className="rounded px-1.5 text-xs font-semibold tabular-nums text-white"
                        style={{ background: scoreColor(c.bestScore) }}
                      >
                        {c.bestScore}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>

      {/* Level derivation note */}
      <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-500/30 dark:bg-brand-500/10">
        <h3 className="mb-1 text-sm font-semibold text-brand-800 dark:text-brand-200">
          How your experience level was derived
        </h3>
        <p className="text-sm text-brand-900/80 dark:text-brand-100/80">
          Level <strong>{level.level}</strong> is computed from your résumé, not selected manually.
        </p>
        <ul className="mt-2 space-y-1">
          {level.rationale.map((r, i) => (
            <li key={i} className="text-xs text-brand-900/70 dark:text-brand-100/70">
              • {r}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function topAfterBest(stats: DashboardStats): ScoredJob[] {
  // stats.byRole jobs are already scored; reconstruct the global ranking minus best.
  const all = stats.byRole.flatMap((g) => g.jobs)
  const seen = new Set<string>()
  const unique = all.filter((j) => (seen.has(j.id) ? false : (seen.add(j.id), true)))
  return unique
    .filter((j) => j.id !== stats.bestJob?.id)
    .sort((a, b) => b.score - a.score)
}

function scoreColor(score: number): string {
  return score >= 80 ? '#10b981' : score >= 65 ? '#6366f1' : score >= 45 ? '#f59e0b' : '#94a3b8'
}

function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent: 'emerald' | 'brand' | 'indigo' | 'slate'
}) {
  const ring: Record<string, string> = {
    emerald: 'from-emerald-500/10 to-emerald-500/0 text-emerald-600 dark:text-emerald-400',
    brand: 'from-brand-500/10 to-brand-500/0 text-brand-600 dark:text-brand-400',
    indigo: 'from-indigo-500/10 to-indigo-500/0 text-indigo-600 dark:text-indigo-400',
    slate: 'from-slate-500/10 to-slate-500/0 text-slate-600 dark:text-slate-300',
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <div className={`absolute inset-0 bg-gradient-to-br ${ring[accent]}`} />
      <div className="relative">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
        <div className={`mt-1 text-3xl font-bold tabular-nums ${ring[accent].split(' ').slice(-2).join(' ')}`}>
          {value}
        </div>
        <div className="text-xs text-slate-400">{sub}</div>
      </div>
    </div>
  )
}
