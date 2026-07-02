import type { ZoneType } from '../types/routes.ts'

// ── "Zone All" defensive shells ─────────────────────────────────────────────────
//
// A quality-of-life shortcut: assign a whole coverage shell's ZONE responsibilities in one press,
// WITHOUT ever moving a defender. Zones are generated from field landmarks — the line of scrimmage,
// the ball / hash, and the field boundaries — NOT from where each defender happens to stand, so the
// same shell comes out regardless of how the user aligned the front. The user may then drag/resize
// any zone. Deep zones use the 'deep' type (a wide oval); hook/curl/flat are the compact types.

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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const byX = (a: ShellDefender, b: ShellDefender) => a.x - b.x
const bySpeedDesc = (a: ShellDefender, b: ShellDefender) => b.speed - a.speed

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

// Zones of the SAME type sit at the same depth, so two that get placed on (nearly) the same lateral
// spot render stacked on top of each other (e.g. a nickel corner's curl and the middle LB's curl both
// at the ball). Fan any such cluster out side by side around its center so every zone is visible.
const MIN_ZONE_SEP = 10   // yards between same-type zone centers
function spreadZones(out: ShellAssignment[], fieldWidth: number): ShellAssignment[] {
  const byType = new Map<string, Array<Extract<ShellAssignment, { kind: 'zone' }>>>()
  for (const a of out) {
    if (a.kind !== 'zone') continue
    const g = byType.get(a.zoneType) ?? []
    g.push(a); byType.set(a.zoneType, g)
  }
  for (const group of byType.values()) {
    group.sort((a, b) => a.x - b.x)
    // Walk left→right, gathering runs of zones closer than MIN_ZONE_SEP into one cluster.
    let i = 0
    while (i < group.length) {
      let j = i + 1
      while (j < group.length && group[j].x - group[j - 1].x < MIN_ZONE_SEP) j++
      const cluster = group.slice(i, j)
      if (cluster.length > 1) {
        const mean = cluster.reduce((s, z) => s + z.x, 0) / cluster.length
        let x = mean - (MIN_ZONE_SEP * (cluster.length - 1)) / 2
        for (const z of cluster) { z.x = Math.max(2, Math.min(fieldWidth - 2, x)); x += MIN_ZONE_SEP }
      }
      i = j
    }
  }
  return out
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
  const zone = (d: ShellDefender, zoneType: ZoneType, x: number, y: number) =>
    out.push({ id: d.id, kind: 'zone', zoneType, x: cx(x), y })

  // Deep lateral landmarks — field-relative so they always span sideline to sideline (no gaps).
  const half    = [C - W / 4, C + W / 4]
  const third   = [C - W / 3, C, C + W / 3]
  const quarter = [C - 3 * W / 8, C - W / 8, C + W / 8, C + 3 * W / 8]   // outL, inL, inR, outR
  const flatX   = [cx(C - W * 0.37), cx(C + W * 0.37)]                    // near the sidelines

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
      zone(safeties[0], 'deep', half[0], yDeep)
      zone(safeties[1], 'deep', half[1], yDeep)
      for (const s of safeties.slice(2)) zone(s, 'curl', C, yCurl)   // extra safeties fill the middle
    } else if (safeties.length === 1) {
      zone(safeties[0], 'deep', C, yDeep)   // one large deep zone, middle of the field
    }
    for (const lb of lbs) out.push({ id: lb.id, kind: 'clear' })   // user assigns them manually
    return out
  }

  // Underneath linebackers, by count (2→hooks, 3→hook/curl/hook, 4→outer/inner). Cover 2 puts the
  // outer LBs in the flats; Cover 3/4 put them in curls.
  function assignLbs(pool: ShellDefender[]) {
    const n = pool.length
    if (n === 0) return
    if (n === 1) { zone(pool[0], 'hook', ballX, yHook); return }
    if (n === 2) { zone(pool[0], 'hook', ballX - 7, yHook); zone(pool[1], 'hook', ballX + 7, yHook); return }
    if (n === 3) { zone(pool[0], 'hook', ballX - 9, yHook); zone(pool[1], 'curl', ballX, yCurl); zone(pool[2], 'hook', ballX + 9, yHook); return }
    const outer: ZoneType = preset === 'cover2' ? 'flat' : 'curl'
    const oy = preset === 'cover2' ? yFlat : yCurl
    const ox = preset === 'cover2' ? flatX : [ballX - 11, 0, 0, ballX + 11]
    zone(pool[0], outer, ox[0], oy)
    zone(pool[1], 'hook', ballX - 5, yHook)
    zone(pool[2], 'hook', ballX + 5, yHook)
    zone(pool[3], outer, ox[preset === 'cover2' ? 1 : 3], oy)
    for (const lb of pool.slice(4)) zone(lb, 'hook', ballX, yHook)   // extras to the middle
  }

  // Corners for Cover 2 (flats). Nickel/dime: outside corners take the flats, inner slots curl/hook.
  function assignCornersFlat() {
    if (cbs.length <= 2) {
      if (cbs[0]) zone(cbs[0], 'flat', flatX[0], yFlat)
      if (cbs[1]) zone(cbs[1], 'flat', flatX[1], yFlat)
      return
    }
    zone(cbs[0], 'flat', flatX[0], yFlat)
    zone(cbs[cbs.length - 1], 'flat', flatX[1], yFlat)
    cbs.slice(1, -1).forEach((cb, i) =>
      i === 0 ? zone(cb, 'curl', ballX, yCurl) : zone(cb, 'hook', ballX + 5, yHook))
  }

  // Outside corners take deep landmarks (Cover 3 thirds / Cover 4 outer quarters); slots curl/hook.
  function assignCornersDeep(leftX: number, rightX: number) {
    const outside = cbs.length <= 2 ? cbs : [cbs[0], cbs[cbs.length - 1]]
    if (outside[0]) zone(outside[0], 'deep', leftX, yDeep)
    if (outside[1]) zone(outside[1], 'deep', rightX, yDeep)
    cbs.filter(c => !outside.includes(c)).forEach((cb, i) =>
      i === 0 ? zone(cb, 'curl', ballX, yCurl) : zone(cb, 'hook', ballX + 5, yHook))
  }

  if (preset === 'cover2') {
    const { deep, restLbs } = pickDeep(2, safeties, lbs)
    deep.sort(byX)
    if (deep[0]) zone(deep[0], 'deep', half[0], yDeep)
    if (deep[1]) zone(deep[1], 'deep', half[1], yDeep)
    const usedDeep = new Set(deep.map(d => d.id))
    for (const s of safeties) if (!usedDeep.has(s.id)) zone(s, 'curl', C, yCurl)   // extra safeties
    assignCornersFlat()
    assignLbs(restLbs)
    return spreadZones(out, W)
  }

  if (preset === 'cover3') {
    assignCornersDeep(third[0], third[2])
    let restLbs = lbs.slice()
    if (safeties.length >= 1) {
      zone(safeties[0], 'deep', third[1], yDeep)          // FS — middle deep third
      for (const s of safeties.slice(1)) zone(s, 'hook', C, yHook)   // SS (+extras) hook
    } else {
      const fs = lbs.slice().sort(bySpeedDesc)[0]         // no safety → fastest LB carries the deep middle
      if (fs) { zone(fs, 'deep', third[1], yDeep); restLbs = lbs.filter(l => l.id !== fs.id) }
    }
    assignLbs(restLbs)
    return spreadZones(out, W)
  }

  // cover4 — four deep: outside CBs (outer quarters) + two safeties (inner quarters).
  assignCornersDeep(quarter[0], quarter[3])
  const { deep, restLbs } = pickDeep(2, safeties, lbs)
  deep.sort(byX)
  if (deep[0]) zone(deep[0], 'deep', quarter[1], yDeep)
  if (deep[1]) zone(deep[1], 'deep', quarter[2], yDeep)
  const usedDeep = new Set(deep.map(d => d.id))
  for (const s of safeties) if (!usedDeep.has(s.id)) zone(s, 'hook', C, yHook)   // extra safeties
  assignLbs(restLbs)
  return spreadZones(out, W)
}
