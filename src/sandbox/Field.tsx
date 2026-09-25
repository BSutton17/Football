// ── The sandbox field ([authored]) ──────────────────────────────────────────
//
// ⚠️ THIS DRAWS WITH THE GAME'S OWN RENDERER, not a lookalike. `drawFrame`, `computeCamera`,
// `drawDrawnRoutes` and `drawActiveStroke` are the exact functions the live game uses, so the
// field, the yard lines, the hash marks, the line of scrimmage, the first-down marker, the player
// chips and the route art are identical by construction rather than by resemblance.
//
// The first version of this file was a hand-rolled SVG approximation. It was quicker to write and
// it was wrong in the way that matters: a formation that looks right on a lookalike field can sit
// a yard off on the real one, and you would not find out until you played it.
//
// ⚠️ THE OL, QB AND DL ARE AUTO-PLACED AND NOT DRAGGABLE. `formation.ts` says it plainly of the
// defensive line: "always on the field and cannot be moved by either player." The same is true of
// the five linemen and the quarterback. They are drawn here because a formation authored without
// them is a formation you cannot actually read — but they are not yours to move.

import { useEffect, useRef, useState } from 'react'
import { drawFrame, drawDrawnRoutes, drawActiveStroke, computeCamera } from '../game/renderer'
import { getOLQBPlayers, getDLPlayers } from '../game/formation'
import { FIELD } from '../constants/simulation'
import type { PositionUpdate, GameState } from '../types/game'
import type { RouteOffset } from './api'

export const BALL_X = FIELD.WIDTH / 2
// A spot with room in both directions, so a deep route and a deep safety both fit on screen.
export const LOS = 40
export const DISTANCE = 10

export interface FieldPlayer {
  slot: string
  label: string
  dx: number
  depth: number
}

interface Props {
  players: FieldPlayer[]
  side: 'offense' | 'defense'
  // The other team, drawn as it really is. Authoring against an empty field is guessing.
  opponents?: FieldPlayer[]
  opponentSide?: 'offense' | 'defense'
  routes?: Record<string, RouteOffset[]>
  blocks?: Set<string>
  carrier?: string | null
  selected?: string | null
  draggable?: boolean
  onMove?: (slot: string, dx: number, depth: number) => void
  onSelect?: (slot: string | null) => void
  onDrawRoute?: (slot: string, points: { x: number; y: number }[]) => void
  // How many down linemen the chosen front puts out. Four unless a 3-4 / 2-5 / 3-3-5 says fewer.
  dlCount?: number
}

// An authored spot to a real field position. The offense lines up BEHIND the line and the defense
// in FRONT of it, and that one sign is the whole difference between the two.
function toPosition(p: FieldPlayer, side: 'offense' | 'defense'): PositionUpdate {
  return {
    id: p.slot,
    x: BALL_X + p.dx,
    y: side === 'defense' ? LOS + p.depth : LOS - p.depth,
    team: side === 'defense' ? 'd' : 'o',
    label: p.label,
    name: p.slot,
  }
}

export default function Field({
  players, side, opponents = [], opponentSide, routes = {}, blocks = new Set(),
  carrier = null, selected = null, draggable = false, dlCount = 4, onMove, onSelect, onDrawRoute,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 760, h: 440 })
  const [stroke, setStroke] = useState<{ slot: string; pts: { x: number; y: number }[] } | null>(null)
  const dragging = useRef<string | null>(null)

  const otherSide = opponentSide ?? (side === 'offense' ? 'defense' : 'offense')

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      setSize({ w, h: Math.round(w * 0.62) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Everyone on the field: what is being authored, the opponent, and the auto-placed players the
  // engine always puts out.
  const mine = players.map(p => toPosition(p, side))
  const theirs = opponents.map(p => toPosition(p, otherSide))
  const auto: PositionUpdate[] = [...getOLQBPlayers(LOS, BALL_X), ...getDLPlayers(LOS, BALL_X, dlCount)]
  const all = [...auto, ...theirs, ...mine]

  // Routes are keyed by slot, which is the position id, so they line up without translation.
  const routeArt: Record<string, { dx: number; dd: number }[]> = {}
  for (const [slot, offsets] of Object.entries(routes)) {
    if (!blocks.has(slot)) routeArt[slot] = offsets
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Only yardLine and distance are read for the line of scrimmage and the first-down marker.
    const gs = { yardLine: LOS, distance: DISTANCE } as unknown as GameState
    drawFrame(ctx, size.w, size.h, gs, all, LOS, selected ?? carrier)
    drawDrawnRoutes(ctx, size.w, size.h, all, LOS, routeArt)
    if (stroke) drawActiveStroke(ctx, size.w, size.h, LOS, stroke.pts)
  })

  // Screen to field yards, through the camera the renderer itself uses — so a drag lands exactly
  // where it appears to.
  const toField = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const cam = computeCamera(size.w, size.h, LOS)
    const cx = (e.clientX - rect.left) * (size.w / rect.width)
    const cy = (e.clientY - rect.top) * (size.h / rect.height)
    return { x: (cx - cam.offsetX) / cam.yardPx, y: cam.topRelY - cy / cam.yardPx }
  }

  const hit = (fx: number, fy: number) => {
    let best: { slot: string; d: number } | null = null
    for (const p of mine) {
      const d = Math.hypot(p.x - fx, p.y - fy)
      if (d < 2.2 && (!best || d < best.d)) best = { slot: p.id, d }
    }
    return best?.slot ?? null
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const { x, y } = toField(e)
    const slot = hit(x, y)
    onSelect?.(slot)
    if (!slot) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    if (draggable) dragging.current = slot
    else if (onDrawRoute) {
      const p = mine.find(q => q.id === slot)!
      setStroke({ slot, pts: [{ x: p.x, y: p.y }] })
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current && !stroke) return
    const { x, y } = toField(e)
    if (dragging.current) {
      const depth = side === 'defense' ? y - LOS : LOS - y
      onMove?.(dragging.current, +(x - BALL_X).toFixed(1), +depth.toFixed(1))
    } else if (stroke) {
      setStroke(s => (s ? { ...s, pts: [...s.pts, { x, y }] } : s))
    }
  }

  const end = () => {
    if (stroke && stroke.pts.length > 2) onDrawRoute?.(stroke.slot, stroke.pts)
    setStroke(null)
    dragging.current = null
  }

  return (
    <div ref={wrapRef} style={{ width: '100%', maxWidth: 860 }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: size.h, borderRadius: 8, touchAction: 'none', display: 'block',
          cursor: draggable ? 'grab' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerLeave={end}
      />
    </div>
  )
}
