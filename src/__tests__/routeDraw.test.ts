import { describe, it, expect } from 'vitest'
import { beautifyRoute, offsetsToPoints, CUT_ANGLE_THRESHOLD } from '../game/routeDraw.ts'
import type { FieldPoint } from '../game/routeDraw.ts'

// ── [route draw] Beautifying a hand-drawn route ──────────────────────────────
//
// The tests below draw the way a person actually would: with tremor. What matters is that the
// SHAPE survives — a hard break stays a hard break, a gentle bend stays a bend — while the wobble
// does not become a series of little cuts the receiver has to plant on.

const START: FieldPoint = { x: 20, y: 30 }

// Adds a deterministic zig-zag tremor to a clean path, imitating an unsteady finger.
function shaky(points: FieldPoint[], amplitude = 0.35): FieldPoint[] {
  return points.map((p, i) => ({
    x: p.x + (i % 2 === 0 ? amplitude : -amplitude),
    y: p.y + (i % 3 === 0 ? amplitude * 0.5 : -amplitude * 0.5),
  }))
}

// Samples a straight line densely, the way a pointer stream would.
function line(from: FieldPoint, to: FieldPoint, n = 20): FieldPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    x: from.x + (to.x - from.x) * (i / (n - 1)),
    y: from.y + (to.y - from.y) * (i / (n - 1)),
  }))
}

const turnAt = (pts: FieldPoint[], i: number) => {
  const ax = pts[i].x - pts[i - 1].x, ay = pts[i].y - pts[i - 1].y
  const bx = pts[i + 1].x - pts[i].x, by = pts[i + 1].y - pts[i].y
  const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}

describe('rejects things that are not routes', () => {
  it('a stray tap', () => {
    expect(beautifyRoute([{ x: 20, y: 30 }], START)).toBeNull()
    expect(beautifyRoute([], START)).toBeNull()
  })

  it('a scribble that never leaves the receiver', () => {
    expect(beautifyRoute(line(START, { x: 20.3, y: 30.4 }), START)).toBeNull()
  })
})

describe('anchoring', () => {
  it('starts from the receiver even when the finger went down away from him', () => {
    // The finger lands ~5 yards away from the receiver and draws upfield from there. The route the
    // receiver runs must still LEAVE FROM HIM — the drawing is treated as intent about where to go,
    // not as a path floating in space that he teleports onto.
    const drawn = line({ x: 24, y: 33 }, { x: 24, y: 45 })
    const out = beautifyRoute(drawn, START)!
    const pts = offsetsToPoints(out, START)

    // Offsets are measured from the receiver, so replaying them starts at him by construction…
    expect(out[0].dx).toBeCloseTo(pts[0].x - START.x, 5)
    // …and the first leg is a run he can actually make, not a jump across the field.
    expect(Math.hypot(pts[0].x - START.x, pts[0].y - START.y)).toBeLessThan(8)
    // The route still ends where it was drawn to.
    expect(pts[pts.length - 1].y).toBeGreaterThan(43)
  })

  it('offsets are relative, so they replay from any position', () => {
    const out = beautifyRoute(line(START, { x: 20, y: 42 }), START)!
    const elsewhere = { x: 40, y: 12 }
    const pts = offsetsToPoints(out, elsewhere)
    expect(pts[pts.length - 1].y - elsewhere.y).toBeCloseTo(out[out.length - 1].dd, 5)
  })
})

describe('tremor is removed, shape is kept', () => {
  it('a shaky straight line becomes a straight route, not a dozen little cuts', () => {
    const drawn = shaky(line(START, { x: 20, y: 48 }, 40))
    const out = beautifyRoute(drawn, START)!

    // A go route is one intention: it must not survive as a long chain of waypoints.
    expect(out.length).toBeLessThanOrEqual(3)
    // …and it must still go about eighteen yards downfield.
    expect(out[out.length - 1].dd).toBeGreaterThan(15)
    // …without wandering sideways.
    expect(Math.abs(out[out.length - 1].dx)).toBeLessThan(1.5)
  })

  it('a shaky path does not invent hard cuts out of the wobble', () => {
    const drawn = shaky(line(START, { x: 20, y: 48 }, 40), 0.5)
    const pts = offsetsToPoints(beautifyRoute(drawn, START)!, START)
    const all = [START, ...pts]
    for (let i = 1; i < all.length - 1; i++) {
      expect(turnAt(all, i)).toBeLessThan(CUT_ANGLE_THRESHOLD)
    }
  })
})

describe('a hard break stays hard', () => {
  // An "out": ten yards up, then a sharp turn to the sideline.
  const drawnOut = [...line(START, { x: 20, y: 40 }, 24), ...line({ x: 20, y: 40 }, { x: 32, y: 40 }, 24)]

  it('keeps the corner as a real cut', () => {
    const pts = offsetsToPoints(beautifyRoute(shaky(drawnOut), START)!, START)
    const all = [START, ...pts]
    const sharpest = Math.max(...all.slice(1, -1).map((_, i) => turnAt(all, i + 1)))
    expect(sharpest).toBeGreaterThanOrEqual(CUT_ANGLE_THRESHOLD)
  })

  it('lands the break at roughly the depth it was drawn at', () => {
    const out = beautifyRoute(shaky(drawnOut), START)!
    const pts = offsetsToPoints(out, START)
    const all = [START, ...pts]
    let breakIdx = 1
    let sharpest = 0
    for (let i = 1; i < all.length - 1; i++) {
      const a = turnAt(all, i)
      if (a > sharpest) { sharpest = a; breakIdx = i }
    }
    expect(all[breakIdx].y - START.y).toBeGreaterThan(7)
    expect(all[breakIdx].y - START.y).toBeLessThan(13)
  })

  it('finishes out toward the sideline', () => {
    const out = beautifyRoute(shaky(drawnOut), START)!
    expect(out[out.length - 1].dx).toBeGreaterThan(8)
  })
})

describe('a gentle bend stays a bend', () => {
  // A quarter-circle bender: no single sharp corner, just continuous curvature.
  const arc: FieldPoint[] = Array.from({ length: 40 }, (_, i) => {
    const t = (i / 39) * (Math.PI / 2)
    return { x: START.x + 12 * Math.sin(t), y: START.y + 12 * (1 - Math.cos(t)) }
  })

  it('is emitted as several points along the curve, not one straight chord', () => {
    const out = beautifyRoute(arc, START)!
    expect(out.length).toBeGreaterThanOrEqual(3)
  })

  it('does not turn the arc into a hard corner', () => {
    const pts = offsetsToPoints(beautifyRoute(arc, START)!, START)
    const all = [START, ...pts]
    for (let i = 1; i < all.length - 1; i++) {
      expect(turnAt(all, i)).toBeLessThan(CUT_ANGLE_THRESHOLD + 15)
    }
  })

  it('the curve actually bows away from the straight line between its ends', () => {
    const pts = offsetsToPoints(beautifyRoute(arc, START)!, START)
    const end = pts[pts.length - 1]
    const mid = pts[Math.floor(pts.length / 2)]
    // Perpendicular offset of the midpoint from the start→end chord.
    const dx = end.x - START.x, dy = end.y - START.y
    const bow = Math.abs((mid.x - START.x) * dy - (mid.y - START.y) * dx) / Math.hypot(dx, dy)
    expect(bow).toBeGreaterThan(0.8)
  })
})

describe('output shape', () => {
  it('produces plain finite numbers ready to send', () => {
    const out = beautifyRoute(shaky(line(START, { x: 30, y: 44 }, 30)), START)!
    for (const o of out) {
      expect(Number.isFinite(o.dx)).toBe(true)
      expect(Number.isFinite(o.dd)).toBe(true)
    }
  })

  it('stays a manageable number of waypoints even for a busy drawing', () => {
    const zig = [
      ...line(START, { x: 26, y: 36 }, 15),
      ...line({ x: 26, y: 36 }, { x: 16, y: 42 }, 15),
      ...line({ x: 16, y: 42 }, { x: 28, y: 48 }, 15),
    ]
    expect(beautifyRoute(shaky(zig), START)!.length).toBeLessThanOrEqual(12)
  })
})
