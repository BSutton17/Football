import type { PositionUpdate } from '../types/game.ts'
import { SIM } from '../constants/simulation.ts'

export interface Snapshot {
  positions: PositionUpdate[]
  time: number  // performance.now() when this arrived from the server
}

// Ticks of history to keep.  At 20 Hz this is 400 ms — enough to absorb
// multi-packet jitter bursts without losing the interpolation bracket.
export const BUFFER_SIZE = 8

// How far behind wall-clock time we render.  Two ticks (100 ms) gives room
// for one late/jittered packet before we have to hold the last known position.
// 100 ms is imperceptible on a play that lasts 2–5 seconds.
export const RENDER_DELAY_MS = SIM.TICK_MS * 2

// Longest gap between two snapshots that can still be treated as ONE tick of movement.
//
// [manual] The server stops broadcasting entirely whenever the sim is frozen — the GO button being
// released, the "It is…" suspense beat, a timeout. Play then resumes with a snapshot that may be
// seconds of WALL time after the previous one but only one tick of SIMULATED movement away from it.
// Interpolating across that gap stretches ~half a yard of motion over the whole pause, so everyone
// crawls for as long as you were paused. Anything beyond this threshold is therefore treated as a
// discontinuity: the stale history is dropped and play resumes crisply from the new snapshot.
//
// Four ticks (200 ms) sits far enough above normal packet jitter that ordinary lag still smooths
// out, while being well under any real pause.
export const MAX_GAP_MS = SIM.TICK_MS * 4

export interface SnapshotBuffer {
  snaps: Snapshot[]
}

export function createBuffer(): SnapshotBuffer {
  return { snaps: [] }
}

// Record a new server tick.  Oldest entry is evicted once the buffer is full.
//
// A snapshot arriving more than MAX_GAP_MS after the previous one means the server was not simply
// slow — it had stopped ticking (a manual-mode freeze, a suspense beat, a timeout). The history
// before that gap describes a different, pre-pause moment and must not be interpolated across, so
// it is discarded and this snapshot becomes the new starting point.
// `now` is injectable so the gap behaviour can be tested deterministically; production callers
// omit it and get the real clock.
export function pushSnapshot(buf: SnapshotBuffer, positions: PositionUpdate[], now = performance.now()): void {
  const last = buf.snaps[buf.snaps.length - 1]

  if (last && now - last.time > MAX_GAP_MS) buf.snaps.length = 0

  buf.snaps.push({ positions, time: now })
  if (buf.snaps.length > BUFFER_SIZE) buf.snaps.shift()
}

// ── Lerp helpers ──────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Blend two snapshots at a specific render time.
// x and y are interpolated; all other fields come from the newer snapshot
// so state changes (ball carrier, open/covered) apply immediately.
function lerpBetween(
  from: Snapshot,
  to: Snapshot,
  renderTime: number,
): PositionUpdate[] {
  const duration = to.time - from.time
  if (duration <= 0) return to.positions

  const t     = Math.max(0, Math.min(1, (renderTime - from.time) / duration))
  const toMap = new Map<string, PositionUpdate>(to.positions.map(p => [p.id, p]))

  const result = from.positions.map(p => {
    const next = toMap.get(p.id)
    if (!next) return p   // player left the field — hold last known position
    return { ...next, x: lerp(p.x, next.x, t), y: lerp(p.y, next.y, t) }
  })

  // Players that appear in `to` but not in `from` (newly placed) are shown
  // immediately at their confirmed position rather than being dropped.
  const fromIds = new Set(from.positions.map(p => p.id))
  for (const p of to.positions) {
    if (!fromIds.has(p.id)) result.push(p)
  }

  return result
}

// ── Public API ────────────────────────────────────────────────────────────────

// Returns smoothed positions for the current animation frame.
//
// Searches the buffer backwards for the pair of snapshots whose timestamps
// bracket (now - RENDER_DELAY_MS), then lerps between them.  This handles
// irregular packet timing: if two packets arrived close together or one was
// delayed, we still find the correct bracket.
//
// Fallback hierarchy:
//   • Only one snapshot → return it directly (game just started)
//   • Render time before oldest snapshot → show oldest (extreme stall)
//   • Render time after newest snapshot → hold newest (server went quiet)
export function getInterpolated(buf: SnapshotBuffer, now: number): PositionUpdate[] {
  const { snaps } = buf
  if (snaps.length === 0) return []
  if (snaps.length === 1) return snaps[0].positions

  const renderTime = now - RENDER_DELAY_MS

  // Walk backwards: newest pair first so we find the bracket in O(1) for the
  // common case (render time is just behind the latest snapshot).
  for (let i = snaps.length - 1; i >= 1; i--) {
    if (snaps[i - 1].time <= renderTime) {
      return lerpBetween(snaps[i - 1], snaps[i], renderTime)
    }
  }

  // Render time is before our entire history — show oldest rather than nothing.
  return snaps[0].positions
}
