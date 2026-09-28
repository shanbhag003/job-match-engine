import type { ScoredJob } from '../types'
import { prettyDomain } from '../lib/scoring'
import ScoreRing from './ScoreRing'

const tierStyle: Record<ScoredJob['tier'], string> = {
  Excellent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Strong: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  Moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  Weak: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
}

interface Props {
  job: ScoredJob
  rank?: number
  applied?: boolean
  onOpen: (job: ScoredJob) => void
}

export default function JobCard({ job, rank, applied, onOpen }: Props) {
  return (
    <button
      onClick={() => onOpen(job)}
      className="group w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-brand-500/60 sm:p-5"
    >
      <div className="flex items-start gap-4">
        <div className="hidden shrink-0 sm:block">
          <ScoreRing score={job.score} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {rank != null && <span className="text-xs font-semibold text-slate-400">#{rank}</span>}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tierStyle[job.tier]}`}>
              {job.tier} fit
            </span>
            {job.city === 'Navi Mumbai' && (
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                ★ Navi Mumbai
              </span>
            )}
            {applied && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                ✓ Applied
              </span>
            )}
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700/50 dark:text-slate-300"
              title={`Sourced from ${job.source}`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" strokeLinecap="round" />
              </svg>
              {job.source}
            </span>
          </div>
          <h3 className="mt-1 truncate text-base font-semibold text-slate-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">
            {job.title}
          </h3>
          {/* Company name — prominent */}
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
              {job.company.charAt(0)}
            </span>
            <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
              {job.company}
            </span>
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{job.locationRaw}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Tag>{prettyDomain(job.domain)}</Tag>
            <Tag>{job.workMode}</Tag>
            <Tag>
              {job.expMin}–{job.expMax} yrs
            </Tag>
            {job.salary && <Tag>{job.salary}</Tag>}
            {job.postedRelative && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Posted {job.postedRelative.toLowerCase()}
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{job.reasons[0]}</p>

          <div className="mt-3 flex items-center gap-2 sm:hidden">
            <ScoreRing score={job.score} size={40} stroke={4} />
            <span className="text-xs text-slate-500">match score</span>
          </div>
        </div>
      </div>
    </button>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
      {children}
    </span>
  )
}
