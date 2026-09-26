import type { PlaySpot, ShellSpot } from '../types/playbook.ts'

// [authored] The picture on a play card.
//
// ⚠️ THIS IS THE REASON THE PANEL IS FULL SCREEN. A list of names asks the player to remember what
// "DAGGER SIT" looks like; a picture tells them. Everything needed is already on the wire — the
// spots arrive in field coordinates and the routes as offsets from them — so the card can draw the
// real play rather than an illustration of one.
//
// Drawn with DOWNFIELD UP, which is how every play in a playbook is drawn and the opposite of the
// engine's y axis: offense sits below the line at y < losY, the defense above it, and a route's
// `dd` runs downfield as y increases. The flip happens once, in `py`.

const FIELD_WIDTH = 53.33

interface Props {
  losY: number
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
    for (const pt of s.route ?? []) hi = Math.max(hi, s.y + pt.dd + 1)
    for (const pt of s.route ?? []) lo = Math.min(lo, s.y + pt.dd - 1)
  }
  for (const s of defense ?? []) {
    hi = Math.max(hi, s.y + 2)
    lo = Math.min(lo, s.y - 2)
    if (s.zoneCenterY != null) hi = Math.max(hi, s.zoneCenterY + 3)
  }
  return { lo, hi }
}

// The mapping from field yards to the 0..100 drawing box, pulled out so the one thing that is easy
// to get quietly wrong — the flip — can be tested without a DOM.
export function project(losY: number, offense?: PlaySpot[], defense?: ShellSpot[]) {
  const { lo, hi } = bounds(losY, offense, defense)
  const h = Math.max(hi - lo, 12)
  return {
    // Field x maps straight across; y is flipped so DOWNFIELD IS UP, which is how a playbook draws
    // a play and the opposite of the engine's axis.
    px: (x: number) => (x / FIELD_WIDTH) * 100,
    py: (y: number) => ((hi - y) / h) * 100,
  }
}

export default function PlayDiagram({ losY, offense, defense }: Props) {
  const { px, py } = project(losY, offense, defense)

  const losPy = py(losY)

  return (
    <svg
      className="play-diagram"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* The line of scrimmage, and a first-down-ish reference so depth reads at a glance. */}
      <line x1="0" y1={losPy} x2="100" y2={losPy} className="pd-los" />

      {/* ── Defense ───────────────────────────────────────────────────────── */}
      {/* Zones first so the defenders sit on top of their own bubbles. */}
      {defense?.filter(s => s.job === 'zone' && s.zoneCenterX != null).map(s => (
        <ellipse
          key={`z${s.slot}`}
          cx={px(s.zoneCenterX as number)}
          cy={py(s.zoneCenterY as number)}
          rx={9}
          ry={7}
          className="pd-zone"
        />
      ))}
      {defense?.map(s => (
        <g key={s.slot}>
          {/* A rusher gets an arrow at the line — the one thing a defense has to read instantly. */}
          {s.job === 'rush' && (
            <line x1={px(s.x)} y1={py(s.y)} x2={px(s.x)} y2={losPy} className="pd-rush" />
          )}
          <circle cx={px(s.x)} cy={py(s.y)} r={3.4} className={`pd-def pd-def--${s.job}`} />
          <text x={px(s.x)} y={py(s.y) + 1.6} className="pd-label">
            {s.job === 'man' ? 'M' : s.job === 'zone' ? 'Z' : s.job === 'spy' ? 'S' : 'R'}
          </text>
        </g>
      ))}

      {/* ── Offense ───────────────────────────────────────────────────────── */}
      {offense?.map(s => {
        // Route points are offsets from where the man lines up, so the path starts at his feet.
        const path = [`${px(s.x)},${py(s.y)}`]
        for (const pt of s.route ?? []) path.push(`${px(s.x + pt.dx)},${py(s.y + pt.dd)}`)
        return (
          <g key={s.slot}>
            {s.route && s.route.length > 0 && (
              <polyline points={path.join(' ')} className="pd-route" />
            )}
            <circle cx={px(s.x)} cy={py(s.y)} r={3.4} className="pd-off" />
            <text x={px(s.x)} y={py(s.y) + 1.6} className="pd-label">
              {s.blocking ? 'B' : s.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
