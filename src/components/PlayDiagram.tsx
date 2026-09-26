import type { PlaySpot, ShellSpot } from '../types/playbook.ts'

// [authored] The picture on a play card.
//
// ⚠️ THIS IS THE REASON THE PANEL IS FULL SCREEN. A list of names asks the player to remember what
// "DAGGER SIT" looks like; a picture tells them. Everything needed is already on the wire — the
// spots arrive in field coordinates and the routes as offsets from them — so the card draws the
// real play rather than an illustration of one.
//
// Drawn with DOWNFIELD UP, which is how every play in a playbook is drawn and the opposite of the
// engine's y axis: offense sits below the line at y < losY, the defense above it, and a route's
// `dd` runs downfield as y increases. The flip happens once, in `py`.
//
// ⚠️ ASPECT IS PRESERVED AND THE GRASS OVERFLOWS THE VIEWBOX. Stretching to fill the card turns
// every player into an ellipse and every route corner into a shear. Instead the drawing keeps its
// proportions and the field is painted far outside the viewBox, so the letterboxed edges are more
// grass rather than dead space — the card looks like a window onto the field at any card shape.

const FIELD_WIDTH = 53.33
// How far past the viewBox the turf is painted. Anything beyond the SVG's own box is clipped, so
// this just has to be bigger than any letterbox will ever be.
const BLEED = 400

// The game's own field palette, so a play card and the live field are recognisably the same place.
const C = {
  grassEven: '#2e7d32',
  grassOdd: '#388e3c',
  line: 'rgba(255,255,255,0.32)',
  los: '#42a5f5',
  firstDown: '#ffd600',
  offense: '#1e88e5',
  defense: '#e53935',
  route: '#ffffff',
}

interface Props {
  losY: number
  /** Yards to go, so the card can show the marker the play has to reach. */
  distance?: number
  offense?: PlaySpot[]
  defense?: ShellSpot[]
}

// The drawing box, in yards, chosen from what is actually on the field rather than fixed — a screen
// pass and four verticals need very different amounts of room.
export function bounds(losY: number, offense?: PlaySpot[], defense?: ShellSpot[]) {
  let lo = losY - 7
  let hi = losY + 12
  for (const s of offense ?? []) {
    lo = Math.min(lo, s.y - 1)
    hi = Math.max(hi, s.y + 1)
    for (const pt of s.route ?? []) {
      hi = Math.max(hi, s.y + pt.dd + 1)
      lo = Math.min(lo, s.y + pt.dd - 1)
    }
  }
  for (const s of defense ?? []) {
    hi = Math.max(hi, s.y + 2)
    lo = Math.min(lo, s.y - 2)
    if (s.zoneCenterY != null) hi = Math.max(hi, s.zoneCenterY + 3)
  }
  return { lo, hi }
}

// The mapping from field yards to the drawing box, pulled out so the one thing that is easy to get
// quietly wrong — the flip — can be tested without a DOM.
export function project(losY: number, offense?: PlaySpot[], defense?: ShellSpot[]) {
  const { lo, hi } = bounds(losY, offense, defense)
  const h = Math.max(hi - lo, 12)
  return {
    // Field x maps straight across; y is flipped so DOWNFIELD IS UP, which is how a playbook draws
    // a play and the opposite of the engine's axis.
    px: (x: number) => (x / FIELD_WIDTH) * 100,
    py: (y: number) => ((hi - y) / h) * 100,
    lo,
    hi,
    h,
  }
}

export default function PlayDiagram({ losY, distance, offense, defense }: Props) {
  const { px, py, lo, hi, h } = project(losY, offense, defense)

  // Five-yard stripes and their lines, only across the part of the field on screen.
  const stripes: { y0: number; y1: number; odd: boolean }[] = []
  const firstBand = Math.floor(lo / 5) * 5
  for (let y = firstBand; y < hi; y += 5) {
    stripes.push({ y0: y, y1: y + 5, odd: Math.floor(y / 5) % 2 === 0 })
  }

  // One unit of the viewBox is 1% of the width; the box is 100 wide by (h / FIELD_WIDTH * 100) tall,
  // which keeps a yard the same size in both directions so nothing is squashed.
  const boxH = (h / FIELD_WIDTH) * 100
  const sy = (y: number) => (py(y) / 100) * boxH

  return (
    <svg
      className="play-diagram"
      viewBox={`0 0 100 ${boxH.toFixed(2)}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {/* ── The field ─────────────────────────────────────────────────────── */}
      {/* Painted well outside the viewBox so the letterboxed edges are grass, not dead space. */}
      <rect x={-BLEED} y={-BLEED} width={BLEED * 2 + 100} height={BLEED * 2 + boxH} fill={C.grassEven} />
      {stripes.map(s => (
        <rect
          key={`b${s.y0}`}
          x={-BLEED}
          y={sy(s.y1)}
          width={BLEED * 2 + 100}
          height={Math.abs(sy(s.y0) - sy(s.y1))}
          fill={s.odd ? C.grassOdd : C.grassEven}
        />
      ))}
      {stripes.map(s => (
        <line
          key={`l${s.y0}`}
          x1={-BLEED} y1={sy(s.y0)} x2={BLEED + 100} y2={sy(s.y0)}
          stroke={C.line} strokeWidth={0.4}
        />
      ))}

      {/* The line of scrimmage, and the marker the play has to reach. */}
      <line x1={-BLEED} y1={sy(losY)} x2={BLEED + 100} y2={sy(losY)} stroke={C.los} strokeWidth={0.9} />
      {distance != null && distance > 0 && losY + distance < hi && (
        <line
          x1={-BLEED} y1={sy(losY + distance)} x2={BLEED + 100} y2={sy(losY + distance)}
          stroke={C.firstDown} strokeWidth={0.8}
        />
      )}

      {/* ── Defense ───────────────────────────────────────────────────────── */}
      {defense?.filter(s => s.job === 'zone' && s.zoneCenterX != null).map(s => (
        <ellipse
          key={`z${s.slot}`}
          cx={px(s.zoneCenterX as number)}
          cy={sy(s.zoneCenterY as number)}
          rx={8}
          ry={8}
          fill="rgba(255,255,255,0.14)"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={0.4}
        />
      ))}
      {defense?.map(s => (
        <g key={s.slot}>
          {s.job === 'rush' && (
            <line
              x1={px(s.x)} y1={sy(s.y)} x2={px(s.x)} y2={sy(losY)}
              stroke={C.defense} strokeWidth={0.9}
            />
          )}
          <circle cx={px(s.x)} cy={sy(s.y)} r={3} fill={C.defense} stroke="rgba(0,0,0,0.35)" strokeWidth={0.4} />
          <text x={px(s.x)} y={sy(s.y) + 1.3} className="pd-label">
            {s.job === 'man' ? 'M' : s.job === 'zone' ? 'Z' : s.job === 'spy' ? 'S' : 'R'}
          </text>
        </g>
      ))}

      {/* ── Offense ───────────────────────────────────────────────────────── */}
      {offense?.map(s => {
        // Route points are offsets from where the man lines up, so the path starts at his feet.
        const path = [`${px(s.x)},${sy(s.y)}`]
        for (const pt of s.route ?? []) path.push(`${px(s.x + pt.dx)},${sy(s.y + pt.dd)}`)
        return (
          <g key={s.slot}>
            {s.route && s.route.length > 0 && (
              <polyline
                points={path.join(' ')}
                fill="none"
                stroke={C.route}
                strokeWidth={1.1}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            <circle cx={px(s.x)} cy={sy(s.y)} r={3} fill={C.offense} stroke="rgba(0,0,0,0.35)" strokeWidth={0.4} />
            <text x={px(s.x)} y={sy(s.y) + 1.3} className="pd-label">
              {s.blocking ? 'B' : s.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
