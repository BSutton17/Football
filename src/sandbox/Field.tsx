// ── The sandbox field ([authored]) ──────────────────────────────────────────
//
// A plain top-down SVG rather than the game's GameCanvas, which is bound to live game state and
// a camera that follows the ball. The sandbox needs the opposite: a fixed, whole-formation view
// that never moves, so a formation can be drawn against a stable grid.
//
// ⚠️ COORDINATES ARE THE SERVER'S, UNCHANGED. `dx` is yards from the ball's hash (negative left)
// and `depth` is yards BEHIND the line of scrimmage. Downfield is +y, exactly as the engine reads
// it, so what is drawn here is what gets played. Converting to some sandbox-local system and back
// is precisely how a formation ends up mirrored or a yard off.

import { useRef, useState } from 'react'
import type { RouteOffset } from './api'

export const FIELD_WIDTH = 53.33
const BEHIND = 9            // yards of backfield shown
const AHEAD = 26            // yards downfield shown
export const VIEW_H = BEHIND + AHEAD
const PX = 17               // pixels per yard

export interface FieldPlayer {
  slot: string
  label: string
  dx: number
  depth: number
}

interface Props {
  players: FieldPlayer[]
  routes?: Record<string, RouteOffset[]>
  blocks?: Set<string>
  carrier?: string | null
  selected?: string | null
  draggable?: boolean
  // ⚠️ Which way `depth` counts. The offense lines up BEHIND the line and the defense in FRONT of
  // it, so one sign flip separates the two — and getting it wrong silently mirrors a whole
  // formation through the line of scrimmage.
  side?: 'offense' | 'defense'
  // The other team, drawn faintly. Authoring a defense against nothing means guessing where the
  // receivers will be; showing a real offensive formation makes the alignment mean something.
  ghosts?: FieldPlayer[]
  onMove?: (slot: string, dx: number, depth: number) => void
  onSelect?: (slot: string) => void
  onDrawRoute?: (slot: string, points: { x: number; y: number }[]) => void
}

const COLORS: Record<string, string> = {
  WR: '#4ea1ff', TE: '#ffb64e', RB: '#7ee08a',
  DL: '#ff7b72', LB: '#d2a8ff', CB: '#79c0ff', S: '#ffa657',
}

// Field x (0..53.33) and y (0 = LOS, + downfield) to SVG pixels.
const px = (fx: number) => fx * PX
const py = (fy: number) => (AHEAD - fy) * PX

export default function Field({
  players, routes = {}, blocks = new Set(), carrier = null, selected = null,
  draggable = false, side = 'offense', ghosts = [], onMove, onSelect, onDrawRoute,
}: Props) {
  // The offense lines up behind the line, the defense in front of it.
  const sign = side === 'defense' ? 1 : -1
  const svgRef = useRef<SVGSVGElement>(null)
  const [drawing, setDrawing] = useState<{ slot: string; pts: { x: number; y: number }[] } | null>(null)
  const ballX = FIELD_WIDTH / 2

  // Pointer position in FIELD yards, which is the only coordinate system this file thinks in.
  const toField = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const sx = (e.clientX - rect.left) / rect.width * (FIELD_WIDTH * PX)
    const sy = (e.clientY - rect.top) / rect.height * (VIEW_H * PX)
    return { x: sx / PX, y: AHEAD - sy / PX }
  }

  const startDrag = (slot: string) => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    onSelect?.(slot)
    if (draggable) {
      const move = (ev: PointerEvent) => {
        const rect = svgRef.current!.getBoundingClientRect()
        const fx = (ev.clientX - rect.left) / rect.width * FIELD_WIDTH
        const fy = AHEAD - (ev.clientY - rect.top) / rect.height * VIEW_H
        onMove?.(slot, +(fx - ballX).toFixed(1), +(fy * sign).toFixed(1))
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    } else if (onDrawRoute) {
      // Not draggable means we are authoring a PLAY, and dragging draws a route instead of moving
      // the player — the user's rule: to move someone, edit the formation.
      const p = players.find(x => x.slot === slot)!
      setDrawing({ slot, pts: [{ x: ballX + p.dx, y: sign * p.depth }] })
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing) return
    const pt = toField(e)
    setDrawing(d => (d ? { ...d, pts: [...d.pts, pt] } : d))
  }

  const endDraw = () => {
    if (drawing && drawing.pts.length > 2) onDrawRoute?.(drawing.slot, drawing.pts)
    setDrawing(null)
  }

  // Yard lines every 5, with the LOS drawn heavier because every depth is measured from it.
  const lines = []
  for (let y = -BEHIND; y <= AHEAD; y += 5) {
    lines.push(
      <line key={y} x1={0} x2={px(FIELD_WIDTH)} y1={py(y)} y2={py(y)}
        stroke={y === 0 ? '#e8ecf1' : '#2c3a30'} strokeWidth={y === 0 ? 2 : 1} />,
    )
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${px(FIELD_WIDTH)} ${VIEW_H * PX}`}
      style={{ width: '100%', maxWidth: 760, background: '#16241a', borderRadius: 8, touchAction: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={endDraw}
      onPointerLeave={endDraw}
    >
      {lines}
      {/* Hash the formation is measured from. Every dx in the file is relative to this line. */}
      <line x1={px(ballX)} x2={px(ballX)} y1={0} y2={VIEW_H * PX} stroke="#3c5142" strokeDasharray="3 5" />

      {/* Saved routes */}
      {Object.entries(routes).map(([slot, offsets]) => {
        const p = players.find(x => x.slot === slot)
        if (!p || !offsets?.length) return null
        const sx = ballX + p.dx, sy = sign * p.depth
        const d = [`M ${px(sx)} ${py(sy)}`, ...offsets.map(o => `L ${px(sx + o.dx)} ${py(sy + o.dd)}`)].join(' ')
        return <path key={slot} d={d} fill="none" stroke="#ffd166" strokeWidth={2.2} strokeLinejoin="round" />
      })}

      {/* The one being drawn right now */}
      {drawing && (
        <path
          d={drawing.pts.map((p, i) => `${i ? 'L' : 'M'} ${px(p.x)} ${py(p.y)}`).join(' ')}
          fill="none" stroke="#fff" strokeWidth={2} strokeDasharray="4 3"
        />
      )}

      {/* The other team, for reference only — never interactive. */}
      {ghosts.map(g => (
        <g key={`ghost-${g.slot}`} opacity={0.32} style={{ pointerEvents: 'none' }}>
          <circle cx={px(ballX + g.dx)} cy={py(-g.depth)} r={10}
            fill="none" stroke={COLORS[g.label] ?? '#ccc'} strokeWidth={1.5} strokeDasharray="3 2" />
          <text x={px(ballX + g.dx)} y={py(-g.depth) + 3} textAnchor="middle" fontSize={8} fill="#9fb0a4">
            {g.label}
          </text>
        </g>
      ))}

      {players.map(p => {
        const cx = px(ballX + p.dx), cy = py(sign * p.depth)
        const isCarrier = carrier === p.slot
        const isBlock = blocks.has(p.slot)
        return (
          <g key={p.slot} onPointerDown={startDrag(p.slot)} style={{ cursor: draggable ? 'grab' : 'crosshair' }}>
            <circle
              cx={cx} cy={cy} r={11}
              fill={isBlock ? '#6b7280' : COLORS[p.label] ?? '#ccc'}
              stroke={selected === p.slot ? '#fff' : isCarrier ? '#ff5d5d' : '#0d1510'}
              strokeWidth={selected === p.slot || isCarrier ? 3 : 1.5}
            />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0d1510">
              {p.slot}
            </text>
          </g>
        )
      })}

      {/* The quarterback, drawn because a back placed on top of him is a real and easy mistake. */}
      {side === 'offense' && (
        <>
          <circle cx={px(ballX)} cy={py(-6)} r={9} fill="none" stroke="#6b7a70" strokeDasharray="2 3" />
          <text x={px(ballX)} y={py(-6) + 3} textAnchor="middle" fontSize={8} fill="#6b7a70">QB</text>
        </>
      )}
    </svg>
  )
}
