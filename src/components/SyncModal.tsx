import { useEffect, useState } from 'react'
import type { SyncConfig, SyncState } from '../lib/sync'
import { defaultSyncUrl, pullState } from '../lib/sync'

interface Props {
  open: boolean
  config: SyncConfig | null
  status: SyncStatus
  onConnect: (cfg: SyncConfig, remote: SyncState) => void
  onDisconnect: () => void
  onClose: () => void
}

export type SyncStatus = 'off' | 'connecting' | 'ok' | 'error'

export default function SyncModal({ open, config, status, onConnect, onDisconnect, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setUrl(config?.url || defaultSyncUrl)
      setCode(config?.code || '')
      setError(null)
      setBusy(false)
    }
  }, [open, config])

  if (!open) return null

  async function connect() {
    setError(null)
    const cfg = { url: url.trim(), code: code.trim() }
    if (!/^https?:\/\//.test(cfg.url)) return setError('Enter your Worker URL (https://…workers.dev).')
    if (cfg.code.length < 6) return setError('Sync code must be at least 6 characters.')
    setBusy(true)
    try {
      const remote = await pullState(cfg) // validates the endpoint + code
      onConnect(cfg, remote)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the sync endpoint.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sync across devices</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Applied &amp; not-interested status, shared by a private code.
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

        <div className="space-y-4 p-5">
          {status === 'ok' && config ? (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              ✓ Connected. This device syncs with code <strong>{maskCode(config.code)}</strong>. Open the
              app on another device and connect with the same code.
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Deploy the one-file Worker in <code>/sync</code> (see its README), then enter its URL and a
              private code below. Use the <strong>same code</strong> on each device.
            </p>
          )}

          <Field label="Sync endpoint (Worker URL)">
            <input
              className={inputCls}
              placeholder="https://job-match-sync.you.workers.dev"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <Field label="Sync code (keep it private)">
            <input
              className={inputCls}
              placeholder="e.g. kartik-jobs-8f3k2"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
            />
          </Field>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-1">
            {config ? (
              <button
                onClick={onDisconnect}
                className="text-sm font-medium text-slate-500 hover:text-rose-500"
              >
                Disconnect this device
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={connect}
              disabled={busy}
              className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? 'Connecting…' : config ? 'Reconnect' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function maskCode(code: string): string {
  if (code.length <= 4) return '••••'
  return code.slice(0, 2) + '••••' + code.slice(-2)
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:ring-brand-500/20'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  )
}
