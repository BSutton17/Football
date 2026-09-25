import { describe, it, expect } from 'vitest'
import { drawFrame } from '../game/renderer'
import type { GameState, PositionUpdate } from '../types/game'

// [authored] ⚠️ THE BUG THIS EXISTS FOR.
//
// The sandbox handed drawFrame a GameState carrying only `yardLine` and `distance` — everything
// the line of scrimmage and the first-down marker need. The field drew perfectly, the players drew
// perfectly, and every DESIGN OVERLAY was silently skipped: zone bubbles, man lines, blitz arrows,
// route art. All of them sit behind `phase === 'pre_snap' || 'countdown'`, because in a real game
// they are a pre-snap picture that vanishes at the snap.
//
// Nothing errored. The zones simply were not there, and no test noticed because no test drew
// anything. This one does: it records what the renderer actually asks the canvas to do.

// A canvas that remembers what it was told, so "did it draw the zones" is answerable.
function recordingContext() {
  const calls: string[] = []
  const noop = () => {}
  const target: Record<string, unknown> = {
    canvas: { width: 800, height: 500 },
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: () => ({ data: [] }),
    setLineDash: noop,
    save: noop, restore: noop,
  }
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop]
      // Every other property is either a drawing call we record, or a style we let be set.
      return (...args: unknown[]) => { calls.push(`${prop}(${args.length})`); return undefined }
    },
    set(t, prop: string, value) { t[prop] = value; return true },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

const LOS = 40
const positions: PositionUpdate[] = [
  { id: 'CB1', x: 12, y: LOS + 6, team: 'd', label: 'CB' },
  { id: 'S1', x: 20, y: LOS + 13, team: 'd', label: 'S' },
  { id: 'WR1', x: 12, y: LOS, team: 'o', label: 'WR' },
]
const zoneTypes = { CB1: 'deep', S1: 'deep' }
const zoneCenters = { CB1: { x: 12, y: LOS + 16 }, S1: { x: 26, y: LOS + 18 } }

const render = (gs: GameState | null) => {
  const { ctx, calls } = recordingContext()
  drawFrame(ctx, 800, 500, gs, positions, LOS, null, {}, null, {}, zoneTypes, zoneCenters, [], [])
  return calls
}

describe('the sandbox field draws the coverage overlays', () => {
  it('⚠️ DRAWS ZONES WHEN THE STATE SAYS PRE-SNAP', () => {
    const withPhase = render({ yardLine: LOS, distance: 10, phase: 'pre_snap' } as unknown as GameState)
    const ellipses = withPhase.filter(c => c.startsWith('ellipse')).length
    expect(ellipses).toBeGreaterThan(0)
  })

  it('⚠️ AND DRAWS NOTHING WITHOUT A PHASE — which is exactly what went wrong', () => {
    // The overlays are gated on the phase. A state without one is not an error; it silently
    // produces a field with no coverage on it.
    const noPhase = render({ yardLine: LOS, distance: 10 } as unknown as GameState)
    expect(noPhase.filter(c => c.startsWith('ellipse')).length).toBe(0)

    // ...while still drawing the field and the players, which is why it looked fine.
    expect(noPhase.length).toBeGreaterThan(20)
  })

  it('draws more with two zones than with one, so it is really per-zone', () => {
    const { ctx: c1, calls: one } = recordingContext()
    drawFrame(c1, 800, 500, { yardLine: LOS, distance: 10, phase: 'pre_snap' } as unknown as GameState,
      positions, LOS, null, {}, null, {}, { CB1: 'deep' }, { CB1: zoneCenters.CB1 }, [], [])
    const two = render({ yardLine: LOS, distance: 10, phase: 'pre_snap' } as unknown as GameState)
    const e = (calls: string[]) => calls.filter(c => c.startsWith('ellipse')).length
    expect(e(two)).toBeGreaterThan(e(one))
  })

  it('still draws the line of scrimmage and first-down marker either way', () => {
    // These never depended on the phase, which is why the missing one was so easy to miss.
    expect(render({ yardLine: LOS, distance: 10 } as unknown as GameState).length).toBeGreaterThan(20)
  })
})
