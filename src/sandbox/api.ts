// ── Talking to the playbook dev API ([authored]) ────────────────────────────
//
// The sandbox's only server contact. The endpoint is loopback-only and mounted only when the
// server is started with ENABLE_PLAYBOOK_DEV=1, so every call here fails loudly and usefully when
// it is not — "start the server with ENABLE_PLAYBOOK_DEV=1" is the single most likely thing to
// have gone wrong and the UI should say so rather than showing a spinner forever.

export type Slot = string          // 'WR1' | 'TE2' | 'RB1' ...
export type Category = 'gun' | 'pistol'
export type PlayType = 'pass' | 'run'

export interface Spot { slot: Slot; dx: number; depth: number }
export interface Formation { name: string; category: Category; spots: Spot[] }

export interface RouteOffset { dx: number; dd: number }
export type Assignment =
  | { kind: 'route'; points: RouteOffset[] }
  | { kind: 'block' }
  | { kind: 'carry' }

export interface Play {
  name: string
  formationId: string
  playType: PlayType
  assignments: Record<Slot, Assignment>
}

// ── Defensive shells ────────────────────────────────────────────────────────
//
// ⚠️ These vocabularies MIRROR Server/src/ai/playbook/authored.js, which derives them from the
// shells the engine already expands. They are duplicated here only so the editor can offer
// dropdowns instead of free text; the server validates every save, so any drift shows up
// immediately as a 422 naming the bad value rather than as a shell that plays as nonsense.
export const JOB_TYPES = ['deep', 'under', 'rush', 'man', 'spy'] as const
export const ZONE_TYPES = ['curl', 'flat', 'hook'] as const
export const SPOTS = ['left', 'right', 'middle', 'half', 'third', 'quarter', 'strong'] as const
export const DEF_POSITIONS = ['CB', 'S', 'LB'] as const

export type JobType = typeof JOB_TYPES[number]

export interface ShellJob {
  job: JobType
  positions: string[]
  depth?: number
  spot?: string
  zone?: string
  width?: number
  count?: number
}

export interface Shell {
  name: string
  kind: 'man' | 'zone'
  blurb?: string
  // null lets the AI choose inside/outside/auto at call time; 'in'/'out' pins it.
  forcedLeverage?: 'in' | 'out' | null
  jobs: ShellJob[]
}

export interface Playbook {
  version: number
  formations: Record<string, Formation>
  plays: Record<string, Play>
  shells: Record<string, Shell>
  audit?: { ok: boolean; problems: string[] }
  path?: string
}

const BASE = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  errors: string[]
  dependents?: string[]
  constructor(message: string, errors: string[] = [], dependents?: string[]) {
    super(message)
    this.errors = errors
    this.dependents = dependents
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}/dev${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    // A network-level failure here almost always means the gate, not the network.
    throw new ApiError(
      `Cannot reach the playbook API at ${BASE}. Start the server with ENABLE_PLAYBOOK_DEV=1 npm run dev`,
    )
  }
  if (res.status === 403) {
    throw new ApiError('The playbook API is loopback only — open the sandbox on the same machine as the server.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.error ?? `Request failed (${res.status})`, body.errors ?? [], body.dependents)
  }
  return res.json() as Promise<T>
}

export const getPlaybook = () => call<Playbook>('/playbook')

// Creating a FORMATION also creates its run play server-side — there is nothing to draw on a run,
// so authoring one by hand per formation is pure clicking. `runPlayId` names it; `runNote` says
// why there isn't one (an empty set has no back to hand it to).
export const createItem = (kind: 'formations' | 'plays' | 'shells', item: unknown) =>
  call<{ id: string; runPlayId?: string | null; runNote?: string }>(
    `/playbook/${kind}`, { method: 'POST', body: JSON.stringify(item) },
  )

// ⚠️ The id is kept deliberately: every play stores a formationId, so a new id on edit would
// orphan every play built on the formation.
export const updateItem = (kind: 'formations' | 'plays' | 'shells', id: string, item: unknown) =>
  call<{ id: string }>(`/playbook/${kind}/${id}`, { method: 'PUT', body: JSON.stringify(item) })

export const deleteItem = (kind: 'formations' | 'plays' | 'shells', id: string, force = false) =>
  call<{ ok: true }>(`/playbook/${kind}/${id}${force ? '?force=1' : ''}`, { method: 'DELETE' })
