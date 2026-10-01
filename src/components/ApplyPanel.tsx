import { useMemo, useState } from 'react'
import type { ScoredJob, CandidateProfile, DerivedLevel } from '../types'
import { generateApplication, type ApplyPrefs } from '../lib/apply'

interface Props {
  job: ScoredJob
  profile: CandidateProfile
  level: DerivedLevel
  prefs: ApplyPrefs
}

export default function ApplyPanel({ job, profile, level, prefs }: Props) {
  const app = useMemo(() => generateApplication(job, profile, level, prefs), [job, profile, level, prefs])
  const [open, setOpen] = useState(false)

  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-brand-800 dark:text-brand-200">
          ✍️ Prepare application (auto-drafted)
        </span>
        <span className="text-xs text-brand-600 dark:text-brand-400">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-[11px] text-brand-900/70 dark:text-brand-100/70">
            Drafts from your résumé + this role. Review before sending — nothing is submitted for you.
          </p>

          <Block label="Cover letter" text={app.coverLetter} multiline />

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Screening answers
            </div>
            <div className="space-y-2">
              {app.screening.map((s) => (
                <div
                  key={s.q}
                  className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{s.q}</span>
                    <CopyButton text={s.a} disabled={s.needsInput} />
                  </div>
                  <div
                    className={`text-sm ${
                      s.needsInput
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {s.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Block({ label, text, multiline }: { label: string; text: string; multiline?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <CopyButton text={text} />
      </div>
      <pre
        className={`whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 ${
          multiline ? '' : ''
        }`}
        style={{ fontFamily: 'inherit' }}
      >
        {text}
      </pre>
    </div>
  )
}

function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <button
      disabled={disabled}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          /* clipboard blocked */
        }
      }}
      className="shrink-0 rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {done ? 'Copied ✓' : 'Copy'}
    </button>
  )
}
