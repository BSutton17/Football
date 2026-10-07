import type { RosterPlayer } from '../types/player.ts'

// ── Resting a tired player ([fatigue subs]) ─────────────────────────────────
//
// Requested: anyone in the yellow or red can be swapped for "the next highest available player at
// their position" by tapping his energy bar, or by pressing and holding him at any time; if nobody is
// available at that position (three safeties on the field and three on the roster), nothing happens.

// The man who comes on: same position, not already on the field. A fresh player is preferred over a
// tired one — swapping a gassed safety for another gassed safety is not a rest — and among those, the
// best overall rating. Null when nobody is available, which means "do nothing".
export function pickSubstitute(
  position: string,
  roster: RosterPlayer[],
  onField: Set<string>,
  stamina: Record<string, number> = {},
  tiredAt = 60,
): RosterPlayer | null {
  const tired = (p: RosterPlayer) => (stamina[p.id] ?? 100) <= tiredAt
  const pool = roster.filter(p => p.position === position && !onField.has(p.id))
  if (!pool.length) return null
  pool.sort((a, b) => Number(tired(a)) - Number(tired(b)) || (b.ovr ?? 0) - (a.ovr ?? 0))
  return pool[0]
}

// Moves one key of a per-player record to another player — his route, his coverage, his zone. The
// man coming on takes over the job exactly; only the body changes.
export function moveKey<T>(rec: Record<string, T>, from: string, to: string): Record<string, T> {
  if (!(from in rec)) return rec
  const n = { ...rec }
  n[to] = n[from]
  delete n[from]
  return n
}
