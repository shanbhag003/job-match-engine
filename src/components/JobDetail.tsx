import { useEffect } from 'react'
import type { ScoredJob, ScoreBreakdown } from '../types'
import { prettyDomain } from '../lib/scoring'
import { WEIGHTS } from '../lib/scoring'
import ScoreRing from './ScoreRing'

interface Props {
  job: ScoredJob | null
  applied?: boolean
  appliedOn?: string
  onClose: () => void
  onToggleApplied: (job: ScoredJob) => void
}

const COMPONENT_META: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'domain', label: 'Domain / industry fit' },
  { key: 'role', label: 'Role & seniority fit' },
  { key: 'skills', label: 'Skills overlap' },
  { key: 'experience', label: 'Experience-level fit' },
  { key: 'location', label: 'Location & work mode' },
]

export default function JobDetail({ job, applied, appliedOn, onClose, onToggleApplied }: Props) {
  useEffect(() => {
    if (!job) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [job, onClose])

  if (!job) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl animate-fade-up dark:bg-slate-900">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/90 p-5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">{job.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {job.company} · {job.locationRaw}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-5">
          {/* Score + meta */}
          <div className="flex items-center gap-5 rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/50">
            <ScoreRing score={job.score} size={92} stroke={8} />
            <div className="space-y-1 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Match Score
              </div>
              <div className="font-semibold text-slate-800 dark:text-slate-100">
                {job.tier} career fit
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Chip>{prettyDomain(job.domain)}</Chip>
                <Chip>{job.workMode}</Chip>
                <Chip>
                  {job.expMin}–{job.expMax} yrs
                </Chip>
                <Chip>{job.city}</Chip>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <Section title="Score breakdown">
            <div className="space-y-3">
              {COMPONENT_META.map((c) => {
                const raw = job.breakdown[c.key]
                const contrib = job.contributions[c.key]
                const weight = WEIGHTS[c.key]
                return (
                  <div key={c.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300">{c.label}</span>
                      <span className="tabular-nums text-slate-500">
                        {raw}/100 <span className="text-slate-400">· +{contrib.toFixed(1)} of {weight}</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${raw}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Why it matches */}
          <Section title="Why it matches your profile">
            <ul className="space-y-2">
              {job.reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="mt-0.5 text-brand-500">▸</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Relevant experience */}
          <Section title="Relevant experience from your résumé">
            <ul className="space-y-2">
              {job.relevantExperience.map((r, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
                >
                  {r}
                </li>
              ))}
            </ul>
          </Section>

          {/* Skills */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Section title={`Matching skills (${job.skillMatch.matched.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {job.skillMatch.matched.length ? (
                  job.skillMatch.matched.map((s) => (
                    <span
                      key={s}
                      className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">No direct skill overlap.</span>
                )}
              </div>
            </Section>
            <Section title={`Missing / preferred (${job.skillMatch.missing.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {job.skillMatch.missing.length ? (
                  job.skillMatch.missing.map((s) => (
                    <span
                      key={s}
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 line-through decoration-slate-300 dark:bg-slate-700/50 dark:text-slate-400"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">You cover every listed skill.</span>
                )}
              </div>
            </Section>
          </div>

          {/* Seniority */}
          <Section title="Seniority fit">
            <p className="text-sm text-slate-600 dark:text-slate-300">{job.seniorityFit}</p>
          </Section>

          {/* Posting summary */}
          <Section title="About the role">
            <p className="text-sm text-slate-600 dark:text-slate-300">{job.summary}</p>
            <p className="mt-2 text-xs text-slate-400">
              Source: {job.source} · captured {job.capturedOn}
              {job.postedRelative ? ` · posted ${job.postedRelative}` : ''}
            </p>
          </Section>
        </div>

        {/* Apply footer */}
        <div className="sticky bottom-0 mt-auto space-y-2 border-t border-slate-200 bg-white/90 p-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
          {applied && (
            <p className="text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ✓ Marked as applied{appliedOn ? ` on ${appliedOn}` : ''}
            </p>
          )}
          <div className="flex gap-2">
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (!applied) onToggleApplied(job)
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700"
            >
              Apply on {job.source}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17 17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <button
              onClick={() => onToggleApplied(job)}
              className={`shrink-0 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                applied
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {applied ? 'Applied ✓' : 'Mark applied'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </section>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 shadow-sm dark:bg-slate-700 dark:text-slate-200">
      {children}
    </span>
  )
}
