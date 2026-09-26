import { describe, it, expect } from 'vitest'
import { bounds, project } from '../components/PlayDiagram'
import type { PlaySpot, ShellSpot } from '../types/playbook'

// [authored] The picture on a play card. The mapping is the whole risk here: the engine puts the
// offense BELOW the line (y < losY) and runs a route's `dd` downfield as y increases, while a
// playbook draws downfield UP. Getting the flip backwards produces a diagram that looks plausible
// and shows every route running the wrong way.

const LOS = 40

const wr = (over: Partial<PlaySpot> = {}): PlaySpot => ({
  slot: 'WR1', label: 'WR', x: 10, y: LOS - 1, route: null, blocking: false, ...over,
})
const db = (over: Partial<ShellSpot> = {}): ShellSpot => ({
  slot: 'CB1', label: 'CB', x: 10, y: LOS + 6, job: 'zone', zone: 'flat',
  zoneCenterX: 10, zoneCenterY: LOS + 8, covers: null, shade: 'none', ...over,
})

describe('the drawing box', () => {
  it('always contains the line of scrimmage with room either side', () => {
    const b = bounds(LOS)
    expect(b.lo).toBeLessThan(LOS)
    expect(b.hi).toBeGreaterThan(LOS)
  })

  it('grows to fit a deep route rather than clipping it', () => {
    const shallow = bounds(LOS, [wr({ route: [{ dx: 0, dd: 5 }] })])
    const deep = bounds(LOS, [wr({ route: [{ dx: 0, dd: 40 }] })])
    expect(deep.hi).toBeGreaterThan(shallow.hi)
    expect(deep.hi).toBeGreaterThanOrEqual(LOS - 1 + 40)
  })

  it('grows to fit a deep zone landmark', () => {
    expect(bounds(LOS, undefined, [db({ zoneCenterY: LOS + 30 })]).hi)
      .toBeGreaterThanOrEqual(LOS + 30)
  })

  it('fits a route that loses ground, like a screen', () => {
    expect(bounds(LOS, [wr({ route: [{ dx: 0, dd: -4 }] })]).lo).toBeLessThanOrEqual(LOS - 5)
  })
})

describe('⚠️ DOWNFIELD IS UP', () => {
  it('puts a deeper point HIGHER on the screen, not lower', () => {
    // SVG y grows downward, so "further downfield" must come out as a SMALLER y.
    const { py } = project(LOS, [wr({ route: [{ dx: 0, dd: 20 }] })])
    expect(py(LOS + 20)).toBeLessThan(py(LOS))
    expect(py(LOS)).toBeLessThan(py(LOS - 5))
  })

  it('puts the offense below the line and the defense above it', () => {
    const { py } = project(LOS, [wr()], [db()])
    expect(py(LOS - 1)).toBeGreaterThan(py(LOS))   // offense: lower on screen
    expect(py(LOS + 6)).toBeLessThan(py(LOS))      // defense: higher on screen
  })

  it('keeps everything inside the 0..100 box', () => {
    const { px, py } = project(LOS, [wr({ x: 0.5, route: [{ dx: 0, dd: 35 }] }), wr({ x: 52.8 })])
    for (const v of [px(0.5), px(52.8), py(LOS + 35), py(LOS - 7)]) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(101)
    }
  })

  it('maps the sidelines to the edges', () => {
    const { px } = project(LOS)
    expect(px(0)).toBeCloseTo(0, 5)
    expect(px(53.33)).toBeCloseTo(100, 1)
  })
})

describe('a route is drawn from the player’s own feet', () => {
  it('treats route points as OFFSETS, not absolute field positions', () => {
    // The wire sends {dx, dd} relative to where the man lines up. Reading them as absolute would
    // pile every route into the same corner of the field.
    const spot = wr({ x: 10, y: LOS - 1, route: [{ dx: 6, dd: 12 }] })
    const { px, py } = project(LOS, [spot])
    const tipX = px(spot.x + spot.route![0].dx)
    const startX = px(spot.x)
    expect(tipX).toBeGreaterThan(startX)              // broke outward
    expect(py(spot.y + spot.route![0].dd)).toBeLessThan(py(spot.y))   // and upfield
  })
})
