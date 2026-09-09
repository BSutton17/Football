import { describe, it, expect } from 'vitest'
import {
  createBuffer, pushSnapshot, getInterpolated,
  RENDER_DELAY_MS, MAX_GAP_MS, BUFFER_SIZE,
} from '../game/interpolation.ts'
import type { PositionUpdate } from '../types/game.ts'

// ── Snapshot interpolation across a server freeze ([manual]) ─────────────────
//
// Manual mode stops the server tick outright while play is frozen, so broadcasts stop with it. The
// interpolator has to tell "the server paused" apart from "a packet was slow": interpolating across
// a pause stretches one tick of movement over the entire pause, which is what made players crawl
// for seconds after every GO press.

const TICK = 50   // server tick spacing, ms

function at(x: number): PositionUpdate[] {
  return [{ id: 'wr1', x, y: 50, team: 'o' }]
}

const xOf = (positions: PositionUpdate[]) => positions.find(p => p.id === 'wr1')!.x

describe('normal streaming', () => {
  it('interpolates between two consecutive ticks', () => {
    const buf = createBuffer()
    pushSnapshot(buf, at(10), 1000)
    pushSnapshot(buf, at(11), 1000 + TICK)

    // Render time sits halfway between the two snapshots.
    const now = 1000 + TICK / 2 + RENDER_DELAY_MS
    expect(xOf(getInterpolated(buf, now))).toBeCloseTo(10.5, 5)
  })

  it('absorbs ordinary packet jitter without dropping history', () => {
    const buf = createBuffer()
    pushSnapshot(buf, at(10), 1000)
    pushSnapshot(buf, at(11), 1000 + MAX_GAP_MS)   // late, but not a pause
    expect(buf.snaps).toHaveLength(2)
  })

  it('evicts the oldest snapshot once the buffer is full', () => {
    const buf = createBuffer()
    for (let i = 0; i <= BUFFER_SIZE; i++) pushSnapshot(buf, at(i), 1000 + i * TICK)
    expect(buf.snaps).toHaveLength(BUFFER_SIZE)
  })
})

describe('a server freeze is a discontinuity, not slow packets', () => {
  it('drops pre-pause history when play resumes', () => {
    const buf = createBuffer()
    pushSnapshot(buf, at(10), 1000)
    pushSnapshot(buf, at(11), 1000 + TICK)
    expect(buf.snaps).toHaveLength(2)

    // …three seconds frozen, then one more tick of actual movement.
    pushSnapshot(buf, at(11.4), 1000 + TICK + 3000)
    expect(buf.snaps).toHaveLength(1)
    expect(xOf(buf.snaps[0].positions)).toBe(11.4)
  })

  it('does not crawl across the gap — the regression this guards', () => {
    const buf = createBuffer()
    pushSnapshot(buf, at(10), 1000)
    const resumeAt = 1000 + 3000
    pushSnapshot(buf, at(10.4), resumeAt)   // one tick of movement after a 3s pause

    // Without the guard the renderer would lerp 10 → 10.4 over three seconds, leaving the player
    // barely off its pre-pause spot a full second after play resumed. It must show the real
    // position immediately instead.
    const oneSecondIn = resumeAt + 1000 + RENDER_DELAY_MS
    expect(xOf(getInterpolated(buf, oneSecondIn))).toBe(10.4)
  })

  it('resumes smooth interpolation on the ticks after a freeze', () => {
    const buf = createBuffer()
    pushSnapshot(buf, at(10), 1000)
    const resumeAt = 1000 + 3000
    pushSnapshot(buf, at(10.4), resumeAt)            // discontinuity — buffer reset
    pushSnapshot(buf, at(10.8), resumeAt + TICK)     // normal tick again

    expect(buf.snaps).toHaveLength(2)
    const half = resumeAt + TICK / 2 + RENDER_DELAY_MS
    expect(xOf(getInterpolated(buf, half))).toBeCloseTo(10.6, 5)
  })

  it('holds the last known position while the server is quiet', () => {
    const buf = createBuffer()
    pushSnapshot(buf, at(10), 1000)
    pushSnapshot(buf, at(10.4), 1000 + TICK)

    // Deep into a freeze: no new snapshots, so the newest is held rather than extrapolated past.
    expect(xOf(getInterpolated(buf, 1000 + 5000))).toBe(10.4)
  })

  it('a freeze exactly at the threshold is still treated as streaming', () => {
    const buf = createBuffer()
    pushSnapshot(buf, at(10), 1000)
    pushSnapshot(buf, at(11), 1000 + MAX_GAP_MS)
    expect(buf.snaps).toHaveLength(2)

    // One millisecond beyond it is not.
    const buf2 = createBuffer()
    pushSnapshot(buf2, at(10), 1000)
    pushSnapshot(buf2, at(11), 1000 + MAX_GAP_MS + 1)
    expect(buf2.snaps).toHaveLength(1)
  })
})
