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

// -- Defense ----------------------------------------------------------------
//
// The defense mirrors the offense: a FORMATION is the alignment of all eleven, and a SHELL is what
// those eleven are told to do.
//
// These vocabularies MIRROR Server/src/ai/playbook/authored.js. They are duplicated here only so
// the editor can offer dropdowns instead of free text; the server validates every save, so drift
// shows up immediately as a 422 naming the bad value rather than as a shell that plays as nonsense.
export const DEF_SLOT_POOL: Record<string, number> = { DL: 4, LB: 4, CB: 4, S: 3 }
export const DEFENDERS = 11
export const DL_COUNT = 4
export const JOBS = ['man', 'zone', 'rush', 'spy'] as const
export const ZONE_TYPES = ['flat', 'curl', 'hook', 'deep'] as const
// Man names an ALIGNMENT ROLE, never a slot, so one shell works against every offensive formation.
// null leaves the matchup to matchMen, which pairs by position and field side.
export const COVER_ROLES = ['X', 'SL', 'Y', 'SR', 'Z', 'RB'] as const

export type DefJob = typeof JOBS[number]

export interface DefSpot { slot: string; dx: number; depth: number }
export interface DefFormation { name: string; spots: DefSpot[] }

export interface DefAssignment {
  job: DefJob
  target?: string | null      // man only
  zone?: string               // zone only
}

export interface Shell {
  name: string
  formationId: string
  kind: 'man' | 'zone'
  // null lets the AI choose inside/outside/auto at call time; 'in'/'out' pins it.
  forcedLeverage?: 'in' | 'out' | null
  assignments: Record<string, DefAssignment>
  // Nudges save onto the SHELL, not the formation — Cover 2 and Cover 3 out of one nickel should
  // be able to show different pictures.
  alignments?: Record<string, { dx: number; depth: number }>
}

export interface Playbook {
  version: number
  formations: Record<string, Formation>
  plays: Record<string, Play>
  defFormations: Record<string, DefFormation>
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
    // ⚠️ The old wording here was `ENABLE_PLAYBOOK_DEV=1 npm run dev`, which is BASH syntax and
    // fails on PowerShell with "is not recognized as the name of a cmdlet". Name the npm script
    // instead — it works on every shell.
    throw new ApiError(
      `Cannot reach the playbook API at ${BASE}. In the Server folder run:  npm run dev:sandbox`,
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
export const createItem = (kind: 'formations' | 'plays' | 'defFormations' | 'shells', item: unknown) =>
  call<{ id: string; runPlayId?: string | null; runNote?: string }>(
    `/playbook/${kind}`, { method: 'POST', body: JSON.stringify(item) },
  )

// ⚠️ The id is kept deliberately: every play stores a formationId, so a new id on edit would
// orphan every play built on the formation.
export const updateItem = (kind: 'formations' | 'plays' | 'defFormations' | 'shells', id: string, item: unknown) =>
  call<{ id: string }>(`/playbook/${kind}/${id}`, { method: 'PUT', body: JSON.stringify(item) })

export const deleteItem = (kind: 'formations' | 'plays' | 'defFormations' | 'shells', id: string, force = false) =>
  call<{ ok: true }>(`/playbook/${kind}/${id}${force ? '?force=1' : ''}`, { method: 'DELETE' })
