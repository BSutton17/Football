import type { ZoneType } from '../types/routes.ts'

// ── "Zone All" defensive shells ─────────────────────────────────────────────────
//
// A quality-of-life shortcut: assign a whole coverage shell's ZONE responsibilities in one press,
// WITHOUT ever moving a defender. Zones are generated from field landmarks — the line of scrimmage,
// the field center and the boundaries — NOT from where each defender happens to stand, so the same
// shell comes out regardless of how the user aligned the front. The user may then drag/resize any
// zone. Deep zones use the 'deep' type (a wide oval); hook/curl/flat are the compact types.
//
// TWO RULES GOVERN THE RESULT:
//
//   1. The landmarks SPAN THE FIELD. Underneath zones are laid out sideline to sideline around the
//      field center rather than bunched around the ball, because the job of a zone shell is to
//      cover the whole width. A Cover 3 whose hooks both sit within a few yards of the ball leaves
//      the numbers open on both sides, which is the opposite of what the call is for.
//
//   2. Defenders take the NEAREST landmark, not the one their position group happens to be ordered
//      into. Assignment used to walk each position group left-to-right and hand out landmarks in
//      order, which regularly sent a defender across the formation to a curl/flat while a shorter
//      hook sat unclaimed beside him. Crossing the field to reach a zone is a legitimate disguise,
//      but it should be something the user chooses, never the default. Within each tier every
//      (defender, landmark) pairing is scored by distance and the closest ones win.

export type ShellPreset = 'cover2' | 'cover3' | 'cover4' | 'reset'
export const SHELL_ORDER: ShellPreset[] = ['cover2', 'cover3', 'cover4', 'reset']
export const SHELL_LABEL: Record<ShellPreset, string> = {
  cover2: 'Cover 2', cover3: 'Cover 3', cover4: 'Cover 4', reset: 'Reset',
}

export interface ShellDefender { id: string; x: number; y: number; label: string; speed: number }
export interface ShellReceiver { id: string; x: number; y: number }

export type ShellAssignment =
  | { id: string; kind: 'zone'; zoneType: ZoneType; x: number; y: number }
  | { id: string; kind: 'man'; targetId: string | null }
  | { id: string; kind: 'clear' }

// Zone depths, in offense-relative yards DOWNFIELD of the LOS (defenders cover toward higher y).
const DEEP_DEPTH = 15
const CURL_DEPTH = 10
const HOOK_DEPTH = 6
const FLAT_DEPTH = 3

// The innermost underneath defender sinks below the rest, into the hole between the safeties. This
// is the shape a zone shell is supposed to have — a bowl, not a flat line — so a seam route running
// between two deep zones has somebody sitting under it.
const MIDDLE_SINK = 3
// Cover 3 has a third deep defender, so its underneath players can squeeze down toward the line
// rather than hanging off at Cover 2 depth.
const COVER3_UNDER_LIFT = 3

// How far out from the field center the OUTERMOST underneath landmark sits, as a fraction of the
// field width. 0.35 of a 53.3-yard field puts it around the numbers — wide enough that a receiver
// running an out has someone waiting, without stranding a defender on the paint.
const UNDER_SPAN = 0.35
// Cover 2's outside underneath players are corners sitting on the flats, so they start wider still.
const FLAT_SPAN  = 0.37
// How much the underneath set slides toward the ball when it is on a hash. Deliberately small: a
// real shell does tilt toward the ball, but the span is what covers the field, and the old
// behaviour — building every underneath landmark off ballX — is exactly what bunched three
// linebackers into the middle third and left both sets of numbers open.
const UNDER_BALL_SHADE = 0.3

interface Landmark { zoneType: ZoneType; x: number; y: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const byX = (a: ShellDefender, b: ShellDefender) => a.x - b.x
const bySpeedDesc = (a: ShellDefender, b: ShellDefender) => b.speed - a.speed

// Evenly spaced lateral spots spanning ±(frac × width) around the field center.
// One landmark sits on the center; two straddle it; n spread edge to edge.
function spanX(n: number, center: number, width: number, frac: number): number[] {
  if (n <= 0) return []
  if (n === 1) return [center]
  const reach = frac * width
  const step  = (2 * reach) / (n - 1)
  return Array.from({ length: n }, (_, i) => center - reach + i * step)
}

// Greedy nearest matching: score every (defender, landmark) pairing by distance and take the
// closest first, so nobody is sent across the formation while a nearer spot goes unclaimed. Ties
// break on id, which keeps the whole shell deterministic for a given alignment.
function matchNearest(
  defenders: ShellDefender[],
  landmarks: Landmark[],
): Array<{ defender: ShellDefender; landmark: Landmark }> {
  const pairs: Array<{ d: ShellDefender; l: Landmark; dist: number }> = []
  for (const d of defenders) {
    for (const l of landmarks) {
      pairs.push({ d, l, dist: Math.hypot(l.x - d.x, l.y - d.y) })
    }
  }
  pairs.sort((a, b) => a.dist - b.dist || a.d.id.localeCompare(b.d.id))

  const usedD = new Set<string>()
  const usedL = new Set<Landmark>()
  const out: Array<{ defender: ShellDefender; landmark: Landmark }> = []
  for (const p of pairs) {
    if (usedD.has(p.d.id) || usedL.has(p.l)) continue
    usedD.add(p.d.id); usedL.add(p.l)
    out.push({ defender: p.d, landmark: p.l })
  }

  // Greedy is fast but not globally optimal, and its failure mode is precisely the one being fixed:
  // when two options tie on distance it can leave a pair CROSSED — the left-hand defender sent to
  // the right-hand zone and vice versa — for the same total travel. So make a second pass and undo
  // any crossing that does not cost anything. In one dimension swapping a crossed pair can never
  // increase the total, so this terminates quickly and never makes the shell worse.
  const span = (a: { defender: ShellDefender; landmark: Landmark }) =>
    Math.hypot(a.landmark.x - a.defender.x, a.landmark.y - a.defender.y)
  for (let guard = 0; guard < 64; guard++) {
    let swapped = false
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j]
        const crossed = (a.defender.x - b.defender.x) * (a.landmark.x - b.landmark.x) < 0
        if (!crossed) continue
        const before = span(a) + span(b)
        const after  = Math.hypot(b.landmark.x - a.defender.x, b.landmark.y - a.defender.y) +
                       Math.hypot(a.landmark.x - b.defender.x, a.landmark.y - b.defender.y)
        if (after <= before + 1e-9) {
          const tmp = a.landmark; a.landmark = b.landmark; b.landmark = tmp
          swapped = true
        }
      }
    }
    if (!swapped) break
  }
  return out
}

// Pull `need` deep defenders: safeties first, then the FASTEST linebackers (edge cases — one/no
// safety). Returns the chosen deep set plus the linebackers still available underneath.
function pickDeep(need: number, safeties: ShellDefender[], lbs: ShellDefender[]) {
  const deep = safeties.slice(0, need)
  let restLbs = lbs.slice()
  if (deep.length < need) {
    const fastest = lbs.slice().sort(bySpeedDesc).slice(0, need - deep.length)
    const ids = new Set(fastest.map(d => d.id))
    deep.push(...fastest)
    restLbs = lbs.filter(l => !ids.has(l.id))
  }
  return { deep, restLbs }
}

export function computeZoneShell(
  preset: ShellPreset,
  defenders: ShellDefender[],
  receivers: ShellReceiver[],
  ballX: number,
  losYardLine: number,
  fieldWidth: number,
): ShellAssignment[] {
  const W = fieldWidth
  const C = W / 2
  const cx = (x: number) => clamp(x, 2, W - 2)
  const yDeep = losYardLine + DEEP_DEPTH
  const yCurl = losYardLine + CURL_DEPTH
  const yHook = losYardLine + HOOK_DEPTH
  const yFlat = losYardLine + FLAT_DEPTH

  const cbs      = defenders.filter(d => d.label === 'CB').sort(byX)
  const safeties = defenders.filter(d => d.label === 'S').sort(byX)
  const lbs      = defenders.filter(d => d.label === 'LB').sort(byX)

  const out: ShellAssignment[] = []
  const place = (d: ShellDefender, l: Landmark) =>
    out.push({ id: d.id, kind: 'zone', zoneType: l.zoneType, x: cx(l.x), y: l.y })

  // Assign a pool to a set of landmarks by proximity, and return anyone left over.
  function assignNearest(pool: ShellDefender[], landmarks: Landmark[]): ShellDefender[] {
    const matched = matchNearest(pool, landmarks)
    for (const m of matched) place(m.defender, m.landmark)
    const used = new Set(matched.map(m => m.defender.id))
    return pool.filter(d => !used.has(d.id))
  }

  // Deep lateral landmarks — field-relative so they always span sideline to sideline (no gaps).
  const half    = [C - W / 4, C + W / 4]
  const third   = [C - W / 3, C, C + W / 3]
  const quarter = [C - 3 * W / 8, C - W / 8, C + W / 8, C + 3 * W / 8]   // outL, inL, inR, outR

  // ── Reset: CBs → man on the nearest receiver; safeties → deep; LBs → cleared. ──
  if (preset === 'reset') {
    const taken = new Set<string>()
    for (const cb of cbs) {
      let best: ShellReceiver | null = null, bd = Infinity
      for (const r of receivers) {
        if (taken.has(r.id)) continue
        const d = Math.hypot(r.x - cb.x, r.y - cb.y)
        if (d < bd) { bd = d; best = r }
      }
      if (best) taken.add(best.id)
      out.push({ id: cb.id, kind: 'man', targetId: best?.id ?? null })
    }
    if (safeties.length >= 2) {
      const deepMarks: Landmark[] = half.map(x => ({ zoneType: 'deep' as ZoneType, x, y: yDeep }))
      const spare = assignNearest(safeties, deepMarks)
      for (const s of spare) place(s, { zoneType: 'curl', x: C, y: yCurl })   // extra safeties
    } else if (safeties.length === 1) {
      place(safeties[0], { zoneType: 'deep', x: C, y: yDeep })   // one large deep zone, middle
    }
    for (const lb of lbs) out.push({ id: lb.id, kind: 'clear' })   // user assigns them manually
    return out
  }

  // ── Underneath landmarks ──
  // Laid out across the whole field for however many defenders are left, outermost first. The two
  // outside spots are the curl/flat players (flats in Cover 2, curls in Cover 3/4); everything
  // inside them is a hook. This is what stops a three-linebacker Cover 3 from bunching all three
  // within a few yards of the ball and leaving both sets of numbers uncovered.
  // Cover 2 sends its corners to the flats and fills the middle with CURLS; Cover 3 keeps its
  // corners deep and puts HOOKS on the outside with curls inside them. Either way the innermost
  // underneath defender drops MIDDLE_SINK yards below his neighbours, into the hole between the
  // deep zones.
  function underLandmarks(n: number): Landmark[] {
    if (n <= 0) return []
    const isCover2 = preset === 'cover2'
    // Outside underneath: Cover 2's are corners on the flats, Cover 3/4's are hooks.
    const outerType: ZoneType = isCover2 ? 'flat' : 'hook'
    const outerY = isCover2 ? yFlat : yHook
    // Everything inside them is a curl. Cover 3 plays the whole underneath a little shallower.
    const innerY = isCover2 ? yCurl : yCurl - COVER3_UNDER_LIFT
    const span   = isCover2 ? FLAT_SPAN : UNDER_SPAN
    const center = C + (ballX - C) * UNDER_BALL_SHADE
    const xs = spanX(n, center, W, span)

    // Which inner landmark is the middle one — the single deepest underneath spot. With an even
    // number of inner zones there is no true middle, so nobody sinks.
    const innerFrom = n > 2 ? 1 : 0
    const innerTo   = n > 2 ? n - 2 : n - 1
    const innerCount = innerTo - innerFrom + 1
    const middleIdx  = innerCount > 0 && innerCount % 2 === 1
      ? innerFrom + (innerCount - 1) / 2
      : -1

    return xs.map((x, i) => {
      const isOuter = n > 2 && (i === 0 || i === n - 1)
      if (isOuter) return { zoneType: outerType, x, y: outerY }
      const y = i === middleIdx ? innerY + MIDDLE_SINK : innerY
      return { zoneType: 'curl' as ZoneType, x, y }
    })
  }

  if (preset === 'cover2') {
    // Two deep halves; the corners sit on the flats and the linebackers fill underneath.
    const { deep, restLbs } = pickDeep(2, safeties, lbs)
    const deepMarks: Landmark[] = half.map(x => ({ zoneType: 'deep' as ZoneType, x, y: yDeep }))
    const spareDeep = assignNearest(deep, deepMarks)

    const usedDeep = new Set(deep.map(d => d.id))
    const under = [...cbs, ...restLbs, ...safeties.filter(s => !usedDeep.has(s.id)), ...spareDeep]
    assignNearest(under, underLandmarks(under.length))
    return out
  }

  if (preset === 'cover3') {
    // Three deep thirds: the outside corners bail to the outer thirds, a safety takes the middle.
    const outsideCbs = cbs.length <= 2 ? cbs : [cbs[0], cbs[cbs.length - 1]]
    const outerMarks: Landmark[] = [third[0], third[2]].map(x => ({ zoneType: 'deep' as ZoneType, x, y: yDeep }))
    assignNearest(outsideCbs, outerMarks)

    let restLbs = lbs.slice()
    const usedDeep = new Set(outsideCbs.map(d => d.id))
    if (safeties.length >= 1) {
      place(safeties[0], { zoneType: 'deep', x: third[1], y: yDeep })
      usedDeep.add(safeties[0].id)
    } else {
      const fs = lbs.slice().sort(bySpeedDesc)[0]   // no safety → fastest LB carries the deep middle
      if (fs) { place(fs, { zoneType: 'deep', x: third[1], y: yDeep }); restLbs = lbs.filter(l => l.id !== fs.id) }
    }

    const under = [
      ...cbs.filter(c => !usedDeep.has(c.id)),
      ...safeties.filter(s => !usedDeep.has(s.id)),
      ...restLbs,
    ]
    assignNearest(under, underLandmarks(under.length))
    return out
  }

  // cover4 — four deep: outside CBs (outer quarters) + two safeties (inner quarters).
  const outsideCbs = cbs.length <= 2 ? cbs : [cbs[0], cbs[cbs.length - 1]]
  assignNearest(outsideCbs, [quarter[0], quarter[3]].map(x => ({ zoneType: 'deep' as ZoneType, x, y: yDeep })))
  const { deep, restLbs } = pickDeep(2, safeties, lbs)
  const spareDeep = assignNearest(deep, [quarter[1], quarter[2]].map(x => ({ zoneType: 'deep' as ZoneType, x, y: yDeep })))

  const usedDeep = new Set([...outsideCbs.map(d => d.id), ...deep.map(d => d.id)])
  const under = [
    ...cbs.filter(c => !usedDeep.has(c.id)),
    ...safeties.filter(s => !usedDeep.has(s.id)),
    ...restLbs,
    ...spareDeep,
  ]
  assignNearest(under, underLandmarks(under.length))
  return out
}
