// ── Route beautification ([route draw]) ──────────────────────────────────────
//
// Turns the wobbly path a finger actually traces into a route a receiver could plausibly run,
// without flattening it into one of the built-in route shapes.
//
// Nobody draws cleanly. A hand-drawn "out" is a shaky diagonal with a rounded corner and a hook at
// the end where the finger lifted. The intent, though, is obvious to a human: run up, break hard
// right. The job here is to recover that intent and throw away the tremor — while keeping the parts
// that were deliberate, because a player who draws a rounded bender means the bend.
//
// The pipeline, in order:
//
//   1. anchor      — the route starts at the receiver, wherever the finger actually went down
//   2. resample    — even out the wildly varying point spacing a pointer produces
//   3. smooth      — a moving average kills hand tremor without moving the real corners much
//   4. simplify    — Ramer–Douglas–Peucker finds the vertices that carry the shape
//   5. classify    — each surviving vertex is a hard CUT or part of a CURVE, by turn angle
//   6. rebuild     — cuts stay sharp; curves are re-emitted as a few points along the arc
//
// Step 5 is the whole design. Snapping everything to hard corners turns every drawing into the
// route tree; rounding everything turns a crisp out into a banana. Measuring the angle the player
// actually drew keeps both: sharp where they were sharp, curved where they curved.
//
// Output is a list of { dx, dd } offsets from the receiver — dx lateral, dd downfield — which is
// exactly what the server stores and re-anchors. The server re-clamps everything independently;
// nothing here is trusted.

export interface FieldPoint { x: number; y: number }
export interface RouteOffset { dx: number; dd: number }

// ── The tuning dials ─────────────────────────────────────────────────────────
//
// One line each, in plain English, for what moving the number actually does.

// HOW SHARP A BEND HAS TO BE BEFORE IT COUNTS AS A CUT.
// Lower = more of your bends become hard planted breaks; higher = more of them stay rounded curves.
const CUT_ANGLE_DEG = 35

// HOW FINELY THE RAW FINGER PATH IS CHOPPED UP BEFORE ANYTHING ELSE LOOKS AT IT.
// Lower = keeps more of the fine detail you drew (and more of your shake); higher = coarser, calmer.
const RESAMPLE_STEP = 0.5

// HOW HARD THE SHAKE IS BLURRED OUT.
// Higher = smoother, calmer lines but corners get slightly rounded off; lower = truer to your hand,
// tremor included.
const SMOOTH_WINDOW = 1

// HOW MUCH OF A DETOUR A WIGGLE HAS TO BE BEFORE IT'S TREATED AS SOMETHING YOU MEANT.
// This is the main snapping dial: higher = stronger snapping, only bold shapes survive; lower =
// keeps small deliberate jinks (and small accidental ones too).
const SIMPLIFY_EPSILON = 0.9

// HOW MANY WAYPOINTS A CURVED STRETCH IS BUILT FROM, PER YARD OF CURVE.
// Higher = the receiver hugs the arc more faithfully; lower = he cuts the corner and runs it
// straighter. Too high and he has waypoints closer together than he can steer between.
const CURVE_POINTS_PER_YARD = 0.2

// THE SHORTEST SCRIBBLE THAT COUNTS AS A ROUTE AT ALL, IN YARDS.
// Higher = more stray taps and flicks are ignored; lower = very short routes become drawable.
const MIN_ROUTE_LENGTH = 2.5

// HOW CLOSE TOGETHER TWO WAYPOINTS ARE ALLOWED TO END UP, IN YARDS.
// This is the anti-jitter floor. A receiver steers toward the next waypoint, so waypoints packed
// closer than he can physically turn make him twitch between them instead of flowing through the
// curve. Higher = smoother running, slightly looser adherence to the drawing.
const MIN_WAYPOINT_GAP = 2.5

const dist = (a: FieldPoint, b: FieldPoint) => Math.hypot(b.x - a.x, b.y - a.y)

// ── 2. Resample to even spacing ──────────────────────────────────────────────

function resample(points: FieldPoint[], step: number): FieldPoint[] {
  if (points.length < 2) return points.slice()

  const out: FieldPoint[] = [points[0]]
  let carry = 0

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    let segLen = dist(a, b)
    if (segLen < 1e-6) continue

    let t = (step - carry) / segLen
    while (t <= 1) {
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      segLen -= step
      t += step / dist(a, b)
    }
    carry = Math.max(0, segLen)
  }

  const last = points[points.length - 1]
  if (dist(out[out.length - 1], last) > step * 0.4) out.push(last)
  return out
}

// ── 3. Smooth away hand tremor ───────────────────────────────────────────────

function smooth(points: FieldPoint[], window: number): FieldPoint[] {
  if (points.length < 3) return points.slice()

  return points.map((p, i) => {
    // The endpoints are held fixed: the start is the receiver and the end is where they meant to
    // finish, and averaging either one drags the route away from what was drawn.
    if (i === 0 || i === points.length - 1) return p

    let sx = 0, sy = 0, n = 0
    for (let k = -window; k <= window; k++) {
      const j = i + k
      if (j < 0 || j >= points.length) continue
      sx += points[j].x; sy += points[j].y; n++
    }
    return { x: sx / n, y: sy / n }
  })
}

// ── 4. Simplify to the vertices that carry the shape ─────────────────────────

function rdp(points: FieldPoint[], epsilon: number): FieldPoint[] {
  if (points.length < 3) return points.slice()

  const first = points[0], last = points[points.length - 1]
  let maxDist = 0, index = 0

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last)
    if (d > maxDist) { maxDist = d; index = i }
  }

  if (maxDist <= epsilon) return [first, last]

  const left  = rdp(points.slice(0, index + 1), epsilon)
  const right = rdp(points.slice(index), epsilon)
  return [...left.slice(0, -1), ...right]
}

function perpendicularDistance(p: FieldPoint, a: FieldPoint, b: FieldPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return dist(p, a)
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len
}

// ── 5. Turn angle at each interior vertex ────────────────────────────────────

function turnAngle(prev: FieldPoint, here: FieldPoint, next: FieldPoint): number {
  const ax = here.x - prev.x, ay = here.y - prev.y
  const bx = next.x - here.x, by = next.y - here.y
  const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by)
  if (la < 1e-6 || lb < 1e-6) return 0
  const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))
  return (Math.acos(cos) * 180) / Math.PI
}

// ── 6. Rebuild: sharp cuts stay sharp, curves stay curved ────────────────────
//
// Walks the simplified vertices. A vertex that turns hard is emitted as-is — that is a break, and
// the receiver should plant on it. A run of gently-turning vertices is a curve, and gets re-emitted
// as points sampled along it so the runner arcs through instead of clipping the corners.

function rebuild(simplified: FieldPoint[], smoothPath: FieldPoint[]): FieldPoint[] {
  if (simplified.length <= 2) return simplified.slice()

  const out: FieldPoint[] = [simplified[0]]

  for (let i = 1; i < simplified.length - 1; i++) {
    const angle = turnAngle(simplified[i - 1], simplified[i], simplified[i + 1])

    if (angle >= CUT_ANGLE_DEG) {
      out.push(simplified[i])            // a real break — keep the corner
      continue
    }

    // A gentle bend. Re-sample the ORIGINAL smoothed path across this stretch so the emitted
    // points follow the arc the player actually drew rather than the chord between vertices.
    const arc = sliceAlong(smoothPath, simplified[i - 1], simplified[i + 1])
    const arcLen = pathLength(arc)
    const n = Math.max(1, Math.round(arcLen * CURVE_POINTS_PER_YARD))
    for (let k = 1; k <= n; k++) {
      const at = pointAtFraction(arc, k / (n + 1))
      if (at) out.push(at)
    }
  }

  out.push(simplified[simplified.length - 1])
  return dedupe(out)
}

// The portion of `path` between the points nearest to `from` and `to`.
function sliceAlong(path: FieldPoint[], from: FieldPoint, to: FieldPoint): FieldPoint[] {
  const nearest = (t: FieldPoint) => {
    let best = 0, bd = Infinity
    for (let i = 0; i < path.length; i++) {
      const d = dist(path[i], t)
      if (d < bd) { bd = d; best = i }
    }
    return best
  }
  const a = nearest(from), b = nearest(to)
  return a <= b ? path.slice(a, b + 1) : path.slice(b, a + 1).reverse()
}

function pathLength(path: FieldPoint[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) total += dist(path[i - 1], path[i])
  return total
}

function pointAtFraction(path: FieldPoint[], f: number): FieldPoint | null {
  if (path.length === 0) return null
  const target = pathLength(path) * f
  let travelled = 0
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i])
    if (travelled + seg >= target) {
      const t = seg < 1e-6 ? 0 : (target - travelled) / seg
      return {
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * t,
        y: path[i - 1].y + (path[i].y - path[i - 1].y) * t,
      }
    }
    travelled += seg
  }
  return path[path.length - 1]
}

function dedupe(points: FieldPoint[]): FieldPoint[] {
  const out: FieldPoint[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && dist(last, p) < MIN_WAYPOINT_GAP) continue
    out.push(p)
  }
  return out
}

// ── Public API ───────────────────────────────────────────────────────────────

// raw   — the drawn path in FIELD coordinates (x across, y offense-relative downfield)
// start — the receiver's position; the route is anchored here regardless of where drawing began
//
// Returns offsets ready to send to the server, or null when the drawing was too small to be a
// route. The server independently re-clamps length, the cut lock and the sidelines.
export function beautifyRoute(raw: FieldPoint[], start: FieldPoint): RouteOffset[] | null {
  if (!raw || raw.length < 2) return null

  // 1. Anchor at the receiver, and drop any points drawn essentially on top of him.
  const anchored: FieldPoint[] = [start]
  for (const p of raw) {
    if (dist(p, start) < 0.6) continue
    anchored.push(p)
  }
  if (anchored.length < 2) return null
  if (pathLength(anchored) < MIN_ROUTE_LENGTH) return null

  const evened     = resample(anchored, RESAMPLE_STEP)
  const smoothed   = smooth(evened, SMOOTH_WINDOW)
  const simplified = rdp(smoothed, SIMPLIFY_EPSILON)
  const rebuilt    = rebuild(simplified, smoothed)

  // Drop the anchor itself — the route is a list of places to run TO, and the receiver is already
  // standing at the first one.
  const waypoints = rebuilt.slice(1)
  if (waypoints.length === 0) return null

  return waypoints.map(p => ({
    dx: +(p.x - start.x).toFixed(2),
    dd: +(p.y - start.y).toFixed(2),
  }))
}

// Exposed for the preview renderer: the same offsets as absolute field points again.
export function offsetsToPoints(offsets: RouteOffset[], start: FieldPoint): FieldPoint[] {
  return offsets.map(o => ({ x: start.x + o.dx, y: start.y + o.dd }))
}

export const CUT_ANGLE_THRESHOLD = CUT_ANGLE_DEG
