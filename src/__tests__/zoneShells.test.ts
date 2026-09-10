import { describe, it, expect } from 'vitest'
import { computeZoneShell } from '../game/zoneShells.ts'
import type { ShellDefender, ShellAssignment } from '../game/zoneShells.ts'

// ── "Zone All" shells ────────────────────────────────────────────────────────
//
// Two properties matter and neither used to hold:
//   • nobody crosses the formation to reach a zone when a nearer one is free
//   • the underneath landmarks span the field instead of bunching around the ball

const W   = 53.33
const C   = W / 2
const LOS = 25

const d = (id: string, label: string, x: number, y: number, speed = 80): ShellDefender =>
  ({ id, label, x, y, speed })

// A standard nickel front, laid out left to right the way a user would drag it in.
const STANDARD: ShellDefender[] = [
  d('cbL', 'CB', 5,      LOS + 6),
  d('cbR', 'CB', 48,     LOS + 6),
  d('sL',  'S',  C - 10, LOS + 13),
  d('sR',  'S',  C + 10, LOS + 13),
  d('lbW', 'LB', C - 8,  LOS + 5),
  d('lbM', 'LB', C,      LOS + 5),
  d('lbS', 'LB', C + 8,  LOS + 5),
]

const RECEIVERS = [
  { id: 'wr1', x: 6,  y: LOS },
  { id: 'wr2', x: 47, y: LOS },
  { id: 'te1', x: 34, y: LOS },
]

const zonesOf = (out: ShellAssignment[]) =>
  out.filter((a): a is Extract<ShellAssignment, { kind: 'zone' }> => a.kind === 'zone')

const zoneFor = (out: ShellAssignment[], id: string) => zonesOf(out).find(z => z.id === id)

// How far a defender must travel to reach the zone he was handed.
function travel(out: ShellAssignment[], defenders: ShellDefender[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const z of zonesOf(out)) {
    const def = defenders.find(x => x.id === z.id)!
    m.set(z.id, Math.hypot(z.x - def.x, z.y - def.y))
  }
  return m
}

describe('nobody criss-crosses the formation', () => {
  for (const preset of ['cover2', 'cover3', 'cover4'] as const) {
    it(`${preset}: no defender is sent across the field past a teammate's zone`, () => {
      const out = computeZoneShell(preset, STANDARD, RECEIVERS, C, LOS, W)
      // If two defenders' zones are swapped relative to their alignment, at least one of them
      // crossed the other. Within a depth tier, left-to-right order must be preserved.
      const zones = zonesOf(out)
      const byTier = new Map<number, typeof zones>()
      for (const z of zones) {
        const g = byTier.get(z.y) ?? []
        g.push(z); byTier.set(z.y, g)
      }
      for (const tier of byTier.values()) {
        const withDef = tier.map(z => ({ z, def: STANDARD.find(x => x.id === z.id)! }))
        withDef.sort((a, b) => a.def.x - b.def.x)          // order they line up in
        const xs = withDef.map(p => p.z.x)                 // order of the zones they were given
        const sorted = [...xs].sort((a, b) => a - b)
        expect(xs).toEqual(sorted)
      }
    })

    it(`${preset}: no single defender is sent more than half the field sideways`, () => {
      const out = computeZoneShell(preset, STANDARD, RECEIVERS, C, LOS, W)
      for (const z of zonesOf(out)) {
        const def = STANDARD.find(x => x.id === z.id)!
        expect(Math.abs(z.x - def.x)).toBeLessThan(W / 2)
      }
    })
  }

  it('picks the nearer of two equivalent zones', () => {
    // Two linebackers mirrored either side of the ball, with safeties present so neither gets
    // promoted to the deep middle. Each must take the underneath zone on his own side.
    const pair: ShellDefender[] = [
      d('sL', 'S', C - 9, LOS + 13), d('sR', 'S', C + 9, LOS + 13),
      d('lbLeft', 'LB', C - 9, LOS + 5), d('lbRight', 'LB', C + 9, LOS + 5),
    ]
    const out = computeZoneShell('cover3', pair, RECEIVERS, C, LOS, W)
    // The left one must end up left of the right one — neither is sent across the other.
    expect(zoneFor(out, 'lbLeft')!.x).toBeLessThan(zoneFor(out, 'lbRight')!.x)
  })

  it('no pair of defenders would be better off swapping zones', () => {
    // The real "don't criss-cross" invariant, checked WITHIN a tier. A shell where two defenders
    // at the same depth could trade zones and travel less between them is exactly the bug being
    // fixed. Two caveats keep this honest: long trips are still allowed (if the front is bunched to
    // one side, SOMEBODY has to cover the other side), and swaps ACROSS tiers are not considered —
    // a corner is deliberately kept on a deep third rather than dropped onto a nearer hook, because
    // who plays deep is a football constraint, not a travel-distance one.
    const skewed: ShellDefender[] = [
      d('cbL', 'CB', 4,  LOS + 6), d('cbR', 'CB', 49, LOS + 6),
      d('sL', 'S', C - 9, LOS + 13), d('sR', 'S', C + 9, LOS + 13),
      d('lb1', 'LB', C + 2, LOS + 5), d('lb2', 'LB', C + 6, LOS + 5), d('lb3', 'LB', C + 10, LOS + 5),
    ]
    for (const preset of ['cover2', 'cover3', 'cover4'] as const) {
      const out = zonesOf(computeZoneShell(preset, skewed, RECEIVERS, C, LOS, W))
      const dist = (def: ShellDefender, z: { x: number; y: number }) =>
        Math.hypot(z.x - def.x, z.y - def.y)
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
          if (out[i].y !== out[j].y) continue          // different tier — not interchangeable
          const di = skewed.find(x => x.id === out[i].id)!
          const dj = skewed.find(x => x.id === out[j].id)!
          const now     = dist(di, out[i]) + dist(dj, out[j])
          const swapped = dist(di, out[j]) + dist(dj, out[i])
          expect(swapped).toBeGreaterThanOrEqual(now - 1e-6)
        }
      }
    }
  })
})

describe('cover 3 covers the whole width', () => {
  it('spreads the underneath zones out toward the numbers, not around the ball', () => {
    const out = computeZoneShell('cover3', STANDARD, RECEIVERS, C, LOS, W)
    const under = zonesOf(out).filter(z => z.zoneType !== 'deep')
    expect(under.length).toBeGreaterThanOrEqual(3)
    const xs = under.map(z => z.x).sort((a, b) => a - b)
    // The outermost underneath zones must reach out past the hashes on both sides.
    expect(xs[0]).toBeLessThan(C - 12)
    expect(xs[xs.length - 1]).toBeGreaterThan(C + 12)
    // …and together they must span most of the field.
    expect(xs[xs.length - 1] - xs[0]).toBeGreaterThan(W * 0.55)
  })

  it('still has three deep defenders on the thirds', () => {
    const out = computeZoneShell('cover3', STANDARD, RECEIVERS, C, LOS, W)
    const deep = zonesOf(out).filter(z => z.zoneType === 'deep')
    expect(deep).toHaveLength(3)
    const xs = deep.map(z => z.x).sort((a, b) => a - b)
    expect(xs[0]).toBeLessThan(C - 10)
    expect(xs[1]).toBeGreaterThan(C - 6)
    expect(xs[1]).toBeLessThan(C + 6)
    expect(xs[2]).toBeGreaterThan(C + 10)
  })

  it('the outside corners take the outer thirds, not the middle', () => {
    const out = computeZoneShell('cover3', STANDARD, RECEIVERS, C, LOS, W)
    expect(zoneFor(out, 'cbL')!.x).toBeLessThan(C)
    expect(zoneFor(out, 'cbR')!.x).toBeGreaterThan(C)
  })

  it('a hash ball shades the underneath set only slightly', () => {
    const mid  = computeZoneShell('cover3', STANDARD, RECEIVERS, C, LOS, W)
    const hash = computeZoneShell('cover3', STANDARD, RECEIVERS, C + 3, LOS, W)
    const meanUnder = (o: ShellAssignment[]) => {
      const u = zonesOf(o).filter(z => z.zoneType !== 'deep')
      return u.reduce((s, z) => s + z.x, 0) / u.length
    }
    const shift = meanUnder(hash) - meanUnder(mid)
    expect(shift).toBeGreaterThan(0)     // it does follow the ball…
    expect(shift).toBeLessThan(2)        // …but nowhere near enough to bunch them
  })
})

describe('the shells still assign everyone', () => {
  for (const preset of ['cover2', 'cover3', 'cover4'] as const) {
    it(`${preset}: every defender gets exactly one assignment`, () => {
      const out = computeZoneShell(preset, STANDARD, RECEIVERS, C, LOS, W)
      expect(out).toHaveLength(STANDARD.length)
      expect(new Set(out.map(a => a.id)).size).toBe(STANDARD.length)
    })

    it(`${preset}: no two defenders are given the same spot`, () => {
      const out = computeZoneShell(preset, STANDARD, RECEIVERS, C, LOS, W)
      const keys = zonesOf(out).map(z => `${z.x.toFixed(2)}:${z.y.toFixed(2)}`)
      expect(new Set(keys).size).toBe(keys.length)
    })

    it(`${preset}: every zone is inside the field`, () => {
      const out = computeZoneShell(preset, STANDARD, RECEIVERS, C, LOS, W)
      for (const z of zonesOf(out)) {
        expect(z.x).toBeGreaterThanOrEqual(2)
        expect(z.x).toBeLessThanOrEqual(W - 2)
      }
    })

    it(`${preset}: the same alignment always produces the same shell`, () => {
      const a = computeZoneShell(preset, STANDARD, RECEIVERS, C, LOS, W)
      const b = computeZoneShell(preset, [...STANDARD].reverse(), RECEIVERS, C, LOS, W)
      const key = (o: ShellAssignment[]) => JSON.stringify(
        [...o].sort((x, y) => x.id.localeCompare(y.id)))
      expect(key(a)).toBe(key(b))
    })
  }

  it('cover 2 keeps two deep and puts the corners on the flats', () => {
    const out = computeZoneShell('cover2', STANDARD, RECEIVERS, C, LOS, W)
    expect(zonesOf(out).filter(z => z.zoneType === 'deep')).toHaveLength(2)
    expect(zoneFor(out, 'cbL')!.zoneType).toBe('flat')
    expect(zoneFor(out, 'cbR')!.zoneType).toBe('flat')
  })

  it('cover 4 keeps four deep', () => {
    const out = computeZoneShell('cover4', STANDARD, RECEIVERS, C, LOS, W)
    expect(zonesOf(out).filter(z => z.zoneType === 'deep')).toHaveLength(4)
  })

  it('reset puts the corners in man and clears the linebackers', () => {
    const out = computeZoneShell('reset', STANDARD, RECEIVERS, C, LOS, W)
    expect(out.filter(a => a.kind === 'man')).toHaveLength(2)
    expect(out.filter(a => a.kind === 'clear')).toHaveLength(3)
  })
})

// ── Shell shape: the underneath is a bowl, not a flat line ───────────────────

describe('cover 2 underneath shape', () => {
  it('fills the middle with curls, not hooks', () => {
    const out = computeZoneShell('cover2', STANDARD, RECEIVERS, C, LOS, W)
    const middle = zonesOf(out).filter(z => z.zoneType !== 'deep' && z.zoneType !== 'flat')
    expect(middle).toHaveLength(3)
    for (const z of middle) expect(z.zoneType).toBe('curl')
  })

  it('sinks the middle curl 3 yards below the outside two', () => {
    const out = computeZoneShell('cover2', STANDARD, RECEIVERS, C, LOS, W)
    const curls = zonesOf(out).filter(z => z.zoneType === 'curl').sort((a, b) => a.x - b.x)
    expect(curls).toHaveLength(3)
    expect(curls[1].y - curls[0].y).toBe(3)
    expect(curls[1].y - curls[2].y).toBe(3)
    expect(curls[0].y).toBe(curls[2].y)          // the outside two are level
  })

  it('keeps the corners in the flats outside the curls', () => {
    const out = computeZoneShell('cover2', STANDARD, RECEIVERS, C, LOS, W)
    const flats = zonesOf(out).filter(z => z.zoneType === 'flat').sort((a, b) => a.x - b.x)
    const curls = zonesOf(out).filter(z => z.zoneType === 'curl').sort((a, b) => a.x - b.x)
    expect(flats).toHaveLength(2)
    expect(flats[0].x).toBeLessThan(curls[0].x)
    expect(flats[1].x).toBeGreaterThan(curls[curls.length - 1].x)
    for (const f of flats) expect(f.y).toBeLessThan(curls[0].y)   // flats play shallower
  })
})

describe('cover 3 underneath shape', () => {
  it('puts hooks on the outside and curls inside them', () => {
    const out = computeZoneShell('cover3', STANDARD, RECEIVERS, C, LOS, W)
    const under = zonesOf(out).filter(z => z.zoneType !== 'deep').sort((a, b) => a.x - b.x)
    expect(under.length).toBeGreaterThanOrEqual(4)
    expect(under[0].zoneType).toBe('hook')
    expect(under[under.length - 1].zoneType).toBe('hook')
    for (const z of under.slice(1, -1)) expect(z.zoneType).toBe('curl')
  })

  it('plays its underneath shallower than cover 2 does', () => {
    const c2 = computeZoneShell('cover2', STANDARD, RECEIVERS, C, LOS, W)
    const c3 = computeZoneShell('cover3', STANDARD, RECEIVERS, C, LOS, W)
    const curlY = (o: ShellAssignment[]) =>
      Math.min(...zonesOf(o).filter(z => z.zoneType === 'curl').map(z => z.y))
    expect(curlY(c2) - curlY(c3)).toBe(3)
  })
})
