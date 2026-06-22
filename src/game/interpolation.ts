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

export interface SnapshotBuffer {
  snaps: Snapshot[]
}

export function createBuffer(): SnapshotBuffer {
  return { snaps: [] }
}

// Record a new server tick.  Oldest entry is evicted once the buffer is full.
export function pushSnapshot(buf: SnapshotBuffer, positions: PositionUpdate[]): void {
  buf.snaps.push({ positions, time: performance.now() })
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
