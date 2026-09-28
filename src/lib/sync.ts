import type { ScoredJob } from '../types'

// ---------------------------------------------------------------------------
// Cross-device sync client. Talks to the Cloudflare Worker (see /sync) using a
// private sync code. Applied + not-interested status is pulled & merged on load
// and pushed on change, so every device shows the latest.
// ---------------------------------------------------------------------------

export interface SyncConfig {
  url: string
  code: string
}

export interface SyncState {
  applied: Record<string, { appliedOn: string; job?: ScoredJob }>
  hidden: Record<string, true>
}

const CFG_KEY = 'jmp-sync'

/** The Worker URL baked at build time (repo variable SYNC_URL), if any. */
export const defaultSyncUrl = (import.meta.env.VITE_SYNC_URL as string | undefined) || ''

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY)
    return raw ? (JSON.parse(raw) as SyncConfig) : null
  } catch {
    return null
  }
}

export function saveSyncConfig(cfg: SyncConfig | null) {
  try {
    if (cfg) localStorage.setItem(CFG_KEY, JSON.stringify(cfg))
    else localStorage.removeItem(CFG_KEY)
  } catch {
    /* ignore */
  }
}

function endpoint(cfg: SyncConfig): string {
  return `${cfg.url.replace(/\/+$/, '')}/state?code=${encodeURIComponent(cfg.code)}`
}

export async function pullState(cfg: SyncConfig): Promise<SyncState> {
  const res = await fetch(endpoint(cfg), { cache: 'no-store' })
  if (!res.ok) throw new Error(`sync read failed (${res.status})`)
  const data = (await res.json()) as Partial<SyncState>
  return { applied: data.applied ?? {}, hidden: data.hidden ?? {} }
}

export async function pushState(cfg: SyncConfig, state: SyncState): Promise<void> {
  const res = await fetch(endpoint(cfg), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...state, updatedAt: Date.now() }),
  })
  if (!res.ok) throw new Error(`sync write failed (${res.status})`)
}

/** Additive merge — an applied/hidden entry present on any device is kept. */
export function mergeState(a: SyncState, b: SyncState): SyncState {
  return {
    applied: { ...a.applied, ...b.applied },
    hidden: { ...a.hidden, ...b.hidden },
  }
}
