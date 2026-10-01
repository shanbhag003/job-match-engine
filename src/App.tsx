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
import SyncModal, { type SyncStatus } from './components/SyncModal'
import {
  loadSyncConfig,
  saveSyncConfig,
  pushState,
  pullState,
  type SyncConfig,
  type SyncState,
} from './lib/sync'
import { isTargetRole, loadApplyPrefs, saveApplyPrefs, type ApplyPrefs } from './lib/apply'

type Tab = 'dashboard' | 'apply' | 'matches' | 'applied'

const REFRESH_MS = 60 * 60 * 1000 // auto-refresh every hour
const APPLIED_KEY = 'jmp-applied'
const PROFILE_KEY = 'jmp-profile'
const HIDDEN_KEY = 'jmp-hidden'

// Store a snapshot of the applied job so it stays in the Applied tab even after
// it drops out of the live feed on a later refresh.
type AppliedMap = Record<string, { appliedOn: string; job?: ScoredJob }>

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

function loadHidden(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '{}')
  } catch {
    return {}
  }
}

export default function App() {
  const [rawJobs, setRawJobs] = useState<Job[] | null>(null)
  const [feedMeta, setFeedMeta] = useState<Pick<JobFeedResult, 'generatedAt' | 'live' | 'sources'>>({
    generatedAt: null,
    live: false,
    sources: {},
  })
  const [hidden, setHidden] = useState<Record<string, true>>(loadHidden)
  const [showHidden, setShowHidden] = useState(false)
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(loadSyncConfig)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => (loadSyncConfig() ? 'connecting' : 'off'))
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncReady, setSyncReady] = useState(false)
  const [applyPrefs, setApplyPrefs] = useState<ApplyPrefs>(loadApplyPrefs)
  const [applySource, setApplySource] = useState<string>('All')
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

  // Persist "not interested" (hidden) jobs.
  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden))
    } catch {
      /* ignore */
    }
  }, [hidden])

  const hideJob = useCallback((id: string) => {
    setHidden((h) => ({ ...h, [id]: true }))
    setSelected(null)
  }, [])
  const unhideJob = useCallback((id: string) => {
    setHidden((h) => {
      const next = { ...h }
      delete next[id]
      return next
    })
  }, [])

  // ---- Cross-device sync (Cloudflare Worker, see /sync) ----
  // Merge remote status into local (additive — never lose an application).
  const applyRemote = useCallback((remote: SyncState) => {
    setApplied((prev) => ({ ...remote.applied, ...prev }))
    setHidden((prev) => ({ ...remote.hidden, ...prev }))
  }, [])

  // On load: pull remote once, then allow pushes. Pulling BEFORE the first push
  // is essential so an empty new device can't wipe the shared status.
  useEffect(() => {
    const cfg = loadSyncConfig()
    if (!cfg) {
      setSyncReady(true)
      return
    }
    setSyncStatus('connecting')
    pullState(cfg)
      .then((remote) => {
        applyRemote(remote)
        setSyncStatus('ok')
      })
      .catch(() => setSyncStatus('error'))
      .finally(() => setSyncReady(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push local status to the cloud on change (debounced). Gated on syncReady so
  // the initial pull always wins first.
  useEffect(() => {
    if (!syncConfig || !syncReady) return
    const t = setTimeout(() => {
      pushState(syncConfig, { applied, hidden })
        .then(() => setSyncStatus('ok'))
        .catch(() => setSyncStatus('error'))
    }, 900)
    return () => clearTimeout(t)
  }, [applied, hidden, syncConfig, syncReady])

  const onSyncConnect = useCallback(
    (cfg: SyncConfig, remote: SyncState) => {
      saveSyncConfig(cfg)
      setSyncConfig(cfg)
      applyRemote(remote)
      setSyncReady(true)
      setSyncStatus('ok')
      setSyncOpen(false)
    },
    [applyRemote],
  )

  const onSyncDisconnect = useCallback(() => {
    saveSyncConfig(null)
    setSyncConfig(null)
    setSyncStatus('off')
    setSyncOpen(false)
  }, [])

  // Load jobs from the active source (swap-in-ready for a live API).
  const refresh = useCallback(async () => {
    setRefreshing(true)
    const result = await activeSource.fetchJobs()
    setRawJobs(result.jobs)
    setFeedMeta({ generatedAt: result.generatedAt, live: result.live, sources: result.sources })
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
      else next[job.id] = { appliedOn: new Date().toLocaleDateString(), job }
      return next
    })
  }, [])

  const level = useMemo(() => deriveLevel(profile), [profile])
  const scored = useMemo(
    () => (rawJobs ? rankJobs(rawJobs, profile, level) : []),
    [rawJobs, profile, level],
  )
  // "Not interested" jobs are removed from every view.
  const visibleScored = useMemo(() => scored.filter((j) => !hidden[j.id]), [scored, hidden])
  const hiddenJobs = useMemo(() => scored.filter((j) => hidden[j.id]), [scored, hidden])
  const stats = useMemo(() => buildDashboard(visibleScored, profile), [visibleScored, profile])

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
    if (!query.trim()) return visibleScored
    const q = query.toLowerCase()
    return visibleScored.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.requiredSkills.some((s) => s.toLowerCase().includes(q)),
    )
  }, [visibleScored, query])

  const appliedJobs = useMemo(() => {
    // Prefer the freshly-scored job from the current feed; fall back to the
    // snapshot saved when it was applied (so it survives feed churn).
    const current = new Map(visibleScored.map((j) => [j.id, j]))
    return Object.entries(applied)
      .filter(([id]) => !hidden[id])
      .map(([id, v]) => current.get(id) ?? v.job)
      .filter((j): j is ScoredJob => !!j)
      .sort((a, b) => (applied[b.id].appliedOn > applied[a.id].appliedOn ? 1 : -1))
  }, [visibleScored, applied, hidden])
  const appliedCount = appliedJobs.length
  const hiddenCount = hiddenJobs.length

  // Apply queue: Product Manager / Associate Product Manager roles not yet
  // applied, sorted by fit; filterable by source (e.g. LinkedIn).
  const applyQueueAll = useMemo(
    () => visibleScored.filter((j) => isTargetRole(j.title) && !applied[j.id]),
    [visibleScored, applied],
  )
  const applySources = useMemo(
    () => ['All', ...Array.from(new Set(applyQueueAll.map((j) => j.source)))],
    [applyQueueAll],
  )
  const applyQueue = useMemo(
    () => (applySource === 'All' ? applyQueueAll : applyQueueAll.filter((j) => j.source === applySource)),
    [applyQueueAll, applySource],
  )
  const updateApplyPrefs = useCallback((p: ApplyPrefs) => {
    setApplyPrefs(p)
    saveApplyPrefs(p)
  }, [])

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
            onClick={() => setSyncOpen(true)}
            className="relative rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label="Sync across devices"
            title={
              syncStatus === 'ok'
                ? 'Synced across devices'
                : syncStatus === 'error'
                  ? 'Sync error — tap to fix'
                  : syncStatus === 'connecting'
                    ? 'Syncing…'
                    : 'Sync across devices'
            }
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-7.5 4M3 12a9 9 0 0 0 9 9 9 9 0 0 0 7.5-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 4v4h4M21 20v-4h-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span
              className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-950 ${
                syncStatus === 'ok'
                  ? 'bg-emerald-500'
                  : syncStatus === 'error'
                    ? 'bg-rose-500'
                    : syncStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-slate-300 dark:bg-slate-600'
              }`}
            />
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
          <TabButton active={tab === 'apply'} onClick={() => setTab('apply')}>
            Apply queue ({applyQueueAll.length})
          </TabButton>
          <TabButton active={tab === 'matches'} onClick={() => setTab('matches')}>
            All matches ({visibleScored.length})
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
            onHide={hideJob}
            onSeeAll={() => setTab('matches')}
          />
        ) : tab === 'apply' ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Apply queue</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Product Manager &amp; Associate Product Manager roles, best fit first. Open one for an
                auto-drafted cover letter + screening answers, then apply yourself (e.g. LinkedIn Easy
                Apply). Nothing is submitted for you.
              </p>
            </div>

            {/* Apply preferences used to fill screening answers */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Apply preferences (used in screening answers)
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <PrefInput
                  label="Notice period"
                  placeholder="e.g. 60 days"
                  value={applyPrefs.noticePeriod}
                  onChange={(v) => updateApplyPrefs({ ...applyPrefs, noticePeriod: v })}
                />
                <PrefInput
                  label="Current CTC"
                  placeholder="e.g. 28 LPA"
                  value={applyPrefs.currentCtc}
                  onChange={(v) => updateApplyPrefs({ ...applyPrefs, currentCtc: v })}
                />
                <PrefInput
                  label="Expected CTC"
                  placeholder="e.g. 38 LPA"
                  value={applyPrefs.expectedCtc}
                  onChange={(v) => updateApplyPrefs({ ...applyPrefs, expectedCtc: v })}
                />
              </div>
            </div>

            {/* Source filter */}
            {applySources.length > 2 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">Source:</span>
                {applySources.map((s) => (
                  <button
                    key={s}
                    onClick={() => setApplySource(s)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      applySource === s
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-400">
              {applyQueue.length} role{applyQueue.length !== 1 ? 's' : ''} to apply to
              {applySource !== 'All' ? ` · ${applySource}` : ''}
            </p>

            {applyQueue.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No Product Manager / Associate PM roles to apply to right now
                  {applySource !== 'All' ? ` from ${applySource}` : ''}.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  New roles arrive with the hourly feed. Check back, or switch source above.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {applyQueue.map((j, i) => (
                  <JobCard key={j.id} job={j} rank={i + 1} onOpen={setSelected} onHide={hideJob} />
                ))}
              </div>
            )}
          </div>
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
                <JobCard
                  key={j.id}
                  job={j}
                  rank={i + 1}
                  applied={!!applied[j.id]}
                  onOpen={setSelected}
                  onHide={hideJob}
                />
              ))}
            </div>

            {hiddenCount > 0 && (
              <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <button
                  onClick={() => setShowHidden((s) => !s)}
                  className="flex w-full items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-300"
                >
                  <span>Not interested ({hiddenCount})</span>
                  <span className="text-xs text-brand-600 dark:text-brand-400">
                    {showHidden ? 'Hide list' : 'Show'}
                  </span>
                </button>
                {showHidden && (
                  <ul className="mt-3 space-y-2">
                    {hiddenJobs.map((j) => (
                      <li
                        key={j.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/40"
                      >
                        <span className="min-w-0 truncate text-sm text-slate-500 line-through dark:text-slate-400">
                          {j.title} · {j.company}
                        </span>
                        <button
                          onClick={() => unhideJob(j.id)}
                          className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
                  <JobCard key={j.id} job={j} applied onOpen={setSelected} onHide={hideJob} />
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
            {feedMeta.live ? 'Live feed' : 'Captured listings'}
            {sourceLabel(feedMeta.sources) ? ` · ${sourceLabel(feedMeta.sources)}` : ''}
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
        profile={profile}
        level={level}
        applyPrefs={applyPrefs}
        onClose={() => setSelected(null)}
        onToggleApplied={toggleApplied}
        onHide={hideJob}
      />

      <ResumeUpload
        open={uploadOpen}
        currentProfile={profile}
        isCustom={!!customProfile}
        onApply={applyProfile}
        onReset={resetProfile}
        onClose={() => setUploadOpen(false)}
      />

      <SyncModal
        open={syncOpen}
        config={syncConfig}
        status={syncStatus}
        onConnect={onSyncConnect}
        onDisconnect={onSyncDisconnect}
        onClose={() => setSyncOpen(false)}
      />
    </div>
  )
}

/** "Naukri.com 83 · Adzuna 57" — the live source breakdown for the footer. */
function sourceLabel(sources: Record<string, number>): string {
  const entries = Object.entries(sources).sort((a, b) => b[1] - a[1])
  if (!entries.length) return ''
  return entries.map(([name, n]) => `${name} ${n}`).join(' · ')
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

function PrefInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-400">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/20"
      />
    </label>
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
