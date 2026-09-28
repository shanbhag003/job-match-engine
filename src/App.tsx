import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CandidateProfile, Job, ScoredJob } from './types'
import { profile as baseProfile } from './data/profile'
import { deriveLevel } from './lib/level'
import { rankJobs } from './lib/scoring'
import { buildDashboard } from './lib/dashboard'
import { activeSource, type JobFeedResult } from './lib/jobSource'
import Dashboard from './components/Dashboard'
import JobCard from './components/JobCard'
import JobDetail from './components/JobDetail'
import ResumeUpload from './components/ResumeUpload'

type Tab = 'dashboard' | 'matches' | 'applied'

const REFRESH_MS = 60 * 60 * 1000 // auto-refresh every hour
const APPLIED_KEY = 'jmp-applied'
const PROFILE_KEY = 'jmp-profile'

type AppliedMap = Record<string, { appliedOn: string }>

function loadApplied(): AppliedMap {
  try {
    return JSON.parse(localStorage.getItem(APPLIED_KEY) || '{}')
  } catch {
    return {}
  }
}

function loadCustomProfile(): CandidateProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as CandidateProfile) : null
  } catch {
    return null
  }
}

export default function App() {
  const [rawJobs, setRawJobs] = useState<Job[] | null>(null)
  const [feedMeta, setFeedMeta] = useState<Pick<JobFeedResult, 'generatedAt' | 'live'>>({
    generatedAt: null,
    live: false,
  })
  const [tab, setTab] = useState<Tab>('dashboard')
  const [selected, setSelected] = useState<ScoredJob | null>(null)
  const [query, setQuery] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now())
  const [refreshing, setRefreshing] = useState(false)
  const [applied, setApplied] = useState<AppliedMap>(loadApplied)
  const [customProfile, setCustomProfile] = useState<CandidateProfile | null>(loadCustomProfile)
  const [uploadOpen, setUploadOpen] = useState(false)
  const profile = customProfile ?? baseProfile
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('jmp-theme')
      if (saved) return saved === 'dark'
    } catch {
      /* ignore */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('jmp-theme', dark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [dark])

  // Persist applied jobs.
  useEffect(() => {
    try {
      localStorage.setItem(APPLIED_KEY, JSON.stringify(applied))
    } catch {
      /* ignore */
    }
  }, [applied])

  // Load jobs from the active source (swap-in-ready for a live API).
  const refresh = useCallback(async () => {
    setRefreshing(true)
    const result = await activeSource.fetchJobs()
    setRawJobs(result.jobs)
    setFeedMeta({ generatedAt: result.generatedAt, live: result.live })
    setLastRefreshed(Date.now())
    setRefreshing(false)
  }, [])

  useEffect(() => {
    refresh()
    // Auto-refresh the data every hour so the dashboard stays current when the
    // source is live. With the static source this re-scores the same listings;
    // a live JobSource makes it pull fresh postings.
    const id = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  const toggleApplied = useCallback((job: ScoredJob) => {
    setApplied((prev) => {
      const next = { ...prev }
      if (next[job.id]) delete next[job.id]
      else next[job.id] = { appliedOn: new Date().toLocaleDateString() }
      return next
    })
  }, [])

  const level = useMemo(() => deriveLevel(profile), [profile])
  const scored = useMemo(
    () => (rawJobs ? rankJobs(rawJobs, profile, level) : []),
    [rawJobs, profile, level],
  )
  const stats = useMemo(() => buildDashboard(scored, profile), [scored, profile])

  const applyProfile = useCallback(
    (p: CandidateProfile) => {
      setCustomProfile(p)
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
      } catch {
        /* ignore */
      }
      setUploadOpen(false)
      refresh() // pull the latest jobs and re-score against the new résumé
    },
    [refresh],
  )

  const resetProfile = useCallback(() => {
    setCustomProfile(null)
    try {
      localStorage.removeItem(PROFILE_KEY)
    } catch {
      /* ignore */
    }
    setUploadOpen(false)
    refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    if (!query.trim()) return scored
    const q = query.toLowerCase()
    return scored.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.requiredSkills.some((s) => s.toLowerCase().includes(q)),
    )
  }, [scored, query])

  const appliedJobs = useMemo(
    () =>
      scored
        .filter((j) => applied[j.id])
        .sort((a, b) => (applied[b.id].appliedOn > applied[a.id].appliedOn ? 1 : -1)),
    [scored, applied],
  )
  const appliedCount = Object.keys(applied).length

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4 20V8m0 0 8 6 8-6v12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold sm:text-base">Job Match Engine</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
              Personalized for {profile.name}
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800 sm:flex"
            title="Auto-refreshes hourly"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={refreshing ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {refreshing ? 'Refreshing' : timeAgo(lastRefreshed)}
          </button>
          <button
            onClick={() => setDark((d) => !d)}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label="Toggle theme"
          >
            {dark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.5-6.5-1.4 1.4M6.9 17.1l-1.4 1.4m0-13 1.4 1.4m10.2 10.2 1.4 1.4" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Hero / profile summary */}
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold sm:text-2xl">{profile.name}</h1>
                <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {level.level}
                </span>
                {customProfile && (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    custom résumé
                  </span>
                )}
                <button
                  onClick={() => setUploadOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-300 px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-brand-500/40 dark:text-brand-300 dark:hover:bg-brand-500/10"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 15V3m0 0 4 4m-4-4L8 7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
                  </svg>
                  Update résumé
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{profile.headline}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {profile.summary}
              </p>
            </div>
            <div className="flex gap-3">
              <MiniStat label="Total exp" value={`${level.totalYears} yrs`} />
              <MiniStat label="In product" value={`${level.productYears} yrs`} />
              <MiniStat label="Target band" value={`${level.targetBand.min}–${level.targetBand.max}`} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[...profile.skills.productAndDelivery.slice(0, 8), ...profile.skills.dataAiTools.slice(0, 4)].map(
              (s) => (
                <span
                  key={s}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {s}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="sticky top-[57px] z-20 border-b border-slate-200 bg-slate-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4">
          <TabButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')}>
            Dashboard
          </TabButton>
          <TabButton active={tab === 'matches'} onClick={() => setTab('matches')}>
            All matches ({scored.length})
          </TabButton>
          <TabButton active={tab === 'applied'} onClick={() => setTab('applied')}>
            Applied ({appliedCount})
          </TabButton>
          <div className="ml-auto hidden py-2 md:block">
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Navi Mumbai &amp; Mumbai · Hybrid/On-site · Remote excluded
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {!rawJobs ? (
          <div className="py-20 text-center text-slate-400">Scoring roles…</div>
        ) : tab === 'dashboard' ? (
          <Dashboard
            stats={stats}
            level={level}
            applied={applied}
            onOpen={setSelected}
            onSeeAll={() => setTab('matches')}
          />
        ) : tab === 'matches' ? (
          <div className="space-y-4">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-3 text-slate-400"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, company or skill…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/20"
              />
            </div>
            <p className="text-xs text-slate-400">
              {filtered.length} role{filtered.length !== 1 ? 's' : ''}, ranked by career fit (Navi
              Mumbai breaks ties).
            </p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filtered.map((j, i) => (
                <JobCard key={j.id} job={j} rank={i + 1} applied={!!applied[j.id]} onOpen={setSelected} />
              ))}
            </div>
          </div>
        ) : (
          // Applied tab
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Applied jobs</h2>
              <span className="text-xs text-slate-400">
                {appliedCount} role{appliedCount !== 1 ? 's' : ''} tracked
              </span>
            </div>
            {appliedJobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No applications tracked yet.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Open any role and hit <strong>Apply</strong> (or “Mark applied”) — it’ll appear here.
                  Tracked locally in your browser; no account or credentials needed.
                </p>
                <button
                  onClick={() => setTab('matches')}
                  className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Browse matches
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {appliedJobs.map((j) => (
                  <JobCard key={j.id} job={j} applied onOpen={setSelected} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 dark:border-slate-800">
        <p className="flex flex-wrap items-center justify-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              feedMeta.live ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
            aria-hidden
          />
          <span className="font-medium text-slate-500 dark:text-slate-300">
            {feedMeta.live ? 'Live feed from Naukri.com' : 'Captured listings from Naukri.com'}
          </span>
          {feedMeta.generatedAt && (
            <span>
              · {feedMeta.live ? 'updated' : 'captured'} {formatFeedTime(feedMeta.generatedAt)}
            </span>
          )}
          {feedMeta.live && <span>· auto-refreshes hourly</span>}
        </p>
        <p className="mt-1">
          Personalized job recommendation engine · résumé is the source of truth. Public listings
          only — no login or credentials. Applied jobs are stored locally in your browser.
        </p>
      </footer>

      <JobDetail
        job={selected}
        applied={selected ? !!applied[selected.id] : false}
        appliedOn={selected ? applied[selected.id]?.appliedOn : undefined}
        onClose={() => setSelected(null)}
        onToggleApplied={toggleApplied}
      />

      <ResumeUpload
        open={uploadOpen}
        currentProfile={profile}
        isCustom={!!customProfile}
        onApply={applyProfile}
        onReset={resetProfile}
        onClose={() => setUploadOpen(false)}
      />
    </div>
  )
}

function formatFeedTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  // Date-only strings (baked-in capturedOn) have no time component.
  const hasTime = iso.includes('T')
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'Updated just now'
  if (mins < 60) return `Updated ${mins}m ago`
  return `Updated ${Math.round(mins / 60)}h ago`
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 py-3 px-3 text-sm font-medium transition ${
        active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      {children}
      {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
    </button>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-800/50">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  )
}
