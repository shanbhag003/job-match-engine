import { useEffect, useState } from 'react'
import type { CandidateProfile, Domain } from '../types'
import { extractTextFromPdf, parseProfile } from '../lib/resumeParser'
import { deriveLevel } from '../lib/level'
import { prettyDomain } from '../lib/scoring'
import { ON_PROFILE_DOMAINS } from '../lib/taxonomy'

interface Props {
  open: boolean
  currentProfile: CandidateProfile
  isCustom: boolean
  onApply: (p: CandidateProfile) => void
  onReset: () => void
  onClose: () => void
}

type Stage = 'upload' | 'parsing' | 'review'

export default function ResumeUpload({ open, currentProfile, isCustom, onApply, onReset, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('upload')
  const [draft, setDraft] = useState<CandidateProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')

  useEffect(() => {
    if (open) {
      setStage('upload')
      setDraft(null)
      setError(null)
      setFileName('')
    }
  }, [open])

  if (!open) return null

  async function handleFile(file: File) {
    setError(null)
    setFileName(file.name)
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF résumé.')
      return
    }
    setStage('parsing')
    try {
      const text = await extractTextFromPdf(file)
      if (text.length < 40) throw new Error('Could not read text from this PDF (is it a scan/image?).')
      const parsed = parseProfile(text, currentProfile)
      setDraft(parsed)
      setStage('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse the PDF.')
      setStage('upload')
    }
  }

  const level = draft ? deriveLevel(draft) : null

  function patch(p: Partial<CandidateProfile>) {
    setDraft((d) => (d ? { ...d, ...p } : d))
  }
  function toggleDomain(d: Domain) {
    if (!draft) return
    const has = draft.domains.includes(d)
    patch({ domains: has ? draft.domains.filter((x) => x !== d) : [...draft.domains, d] })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Update résumé</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload a new PDF — the engine re-derives your profile, level and every match score.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {stage === 'upload' && (
            <div>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center transition hover:border-brand-400 hover:bg-brand-50/50 dark:border-slate-600 dark:bg-slate-800/40 dark:hover:border-brand-500">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-500">
                  <path d="M12 15V3m0 0 4 4m-4-4L8 7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
                </svg>
                <div>
                  <div className="font-semibold text-slate-700 dark:text-slate-200">Drop or choose a PDF résumé</div>
                  <div className="text-xs text-slate-400">Parsed in your browser — nothing is uploaded to a server.</div>
                </div>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
              {isCustom && (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
                  <span className="text-amber-700 dark:text-amber-300">A custom résumé is currently active.</span>
                  <button
                    onClick={onReset}
                    className="font-semibold text-amber-700 underline dark:text-amber-300"
                  >
                    Reset to original
                  </button>
                </div>
              )}
            </div>
          )}

          {stage === 'parsing' && (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <p className="text-sm text-slate-500">Reading “{fileName}” and deriving your profile…</p>
            </div>
          )}

          {stage === 'review' && draft && level && (
            <div className="space-y-5">
              <div className="rounded-xl bg-brand-50 p-3 text-sm dark:bg-brand-500/10">
                <span className="text-brand-800 dark:text-brand-200">
                  Parsed “{fileName}”. Review & fix anything below, then re-run the engine. Derived level:{' '}
                  <strong>{level.level}</strong> ({level.totalYears} yrs total, {level.productYears} in product).
                </span>
              </div>

              <Field label="Name">
                <input className={inputCls} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
              </Field>
              <Field label="Headline">
                <input className={inputCls} value={draft.headline} onChange={(e) => patch({ headline: e.target.value })} />
              </Field>
              <Field label="Summary">
                <textarea className={`${inputCls} h-24`} value={draft.summary} onChange={(e) => patch({ summary: e.target.value })} />
              </Field>

              <Field label="Experience (drives your level)">
                <div className="space-y-2">
                  {draft.timeline.map((t, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input
                        className={`${inputCls} flex-1 min-w-[140px]`}
                        value={t.role}
                        onChange={(e) => {
                          const tl = [...draft.timeline]; tl[i] = { ...t, role: e.target.value }; patch({ timeline: tl })
                        }}
                      />
                      <input
                        className={`${inputCls} w-24`}
                        placeholder="YYYY-MM"
                        value={t.start}
                        onChange={(e) => {
                          const tl = [...draft.timeline]; tl[i] = { ...t, start: e.target.value }; patch({ timeline: tl })
                        }}
                      />
                      <input
                        className={`${inputCls} w-24`}
                        placeholder="YYYY-MM / present"
                        value={t.end}
                        onChange={(e) => {
                          const tl = [...draft.timeline]; tl[i] = { ...t, end: e.target.value as typeof t.end }; patch({ timeline: tl })
                        }}
                      />
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={t.isProductRole}
                          onChange={(e) => {
                            const tl = [...draft.timeline]; tl[i] = { ...t, isProductRole: e.target.checked }; patch({ timeline: tl })
                          }}
                        />
                        product
                      </label>
                      <button
                        onClick={() => patch({ timeline: draft.timeline.filter((_, j) => j !== i) })}
                        className="text-slate-400 hover:text-rose-500"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      patch({
                        timeline: [
                          ...draft.timeline,
                          { role: 'Role', org: '', start: '2020-01', end: 'present', isProductRole: true },
                        ],
                      })
                    }
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    + Add role
                  </button>
                </div>
              </Field>

              <Field label="Domains (career depth — drives domain fit)">
                <div className="flex flex-wrap gap-1.5">
                  {ON_PROFILE_DOMAINS.map((d) => {
                    const on = draft.domains.includes(d)
                    return (
                      <button
                        key={d}
                        onClick={() => toggleDomain(d)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                          on
                            ? 'bg-brand-600 text-white'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {prettyDomain(d)}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Order = strength; the leftmost selected counts most.</p>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Product & delivery skills">
                  <textarea
                    className={`${inputCls} h-24`}
                    value={draft.skills.productAndDelivery.join(', ')}
                    onChange={(e) =>
                      patch({ skills: { ...draft.skills, productAndDelivery: splitSkills(e.target.value) } })
                    }
                  />
                </Field>
                <Field label="Data, AI & tools">
                  <textarea
                    className={`${inputCls} h-24`}
                    value={draft.skills.dataAiTools.join(', ')}
                    onChange={(e) => patch({ skills: { ...draft.skills, dataAiTools: splitSkills(e.target.value) } })}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        {stage === 'review' && draft && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4 dark:border-slate-700">
            <button
              onClick={() => setStage('upload')}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              ← Choose another file
            </button>
            <button
              onClick={() => onApply(draft)}
              className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700"
            >
              Re-run engine with this résumé
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const inputCls =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/20 w-full'

function splitSkills(v: string): string[] {
  return v
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  )
}
