import { useEffect, useRef } from 'react'
import { FaFootballBall } from 'react-icons/fa'
import type { GameState, PositionUpdate } from '../types/game.ts'
import { drawFrame, computeCamera, drawRushVisualizer, drawPassLine } from '../game/renderer.ts'
import type { TeamPaint } from '../game/renderer.ts'
import type { CarrierVision } from '../types/game.ts'
import { PLAYER, FIELD } from '../constants/simulation.ts'
import { createCamera, snapCamera, setCameraTarget, stepCamera } from '../game/camera.ts'
import { getPositionYBounds } from '../game/formation.ts'
import type { CameraState } from '../game/camera.ts'
import { createBuffer, pushSnapshot, getInterpolated } from '../game/interpolation.ts'
import type { SnapshotBuffer } from '../game/interpolation.ts'
import { getRoutePath, getRouteMaxForward } from '../game/routePaths.ts'

const RECEIVER_LABELS = new Set(['WR', 'TE', 'RB'])

interface Props {
  gameState: GameState | null
  positions: PositionUpdate[]
  onPlayerMove?: (id: string, x: number, y: number) => void
  onSelect?: (id: string | null) => void
  onThrowReceiver?: (id: string) => void
  onThrowAtDefender?: (id: string) => void
  onScramble?: () => void
  targetReceiverId?: string | null
  routeDepths?: Record<string, number>
  onRouteDepthChange?: (id: string, depth: number) => void
  runAngle?: number | null
  runnerId?: string | null
  runnerBounds?: { minX: number; maxX: number; minY: number; maxY: number } | null
  manTargets?: Record<string, string>
  zoneTypes?: Record<string, string>
  zoneCenters?: Record<string, { x: number; y: number }>
  onZoneCenterMove?: (defenderId: string, x: number, y: number) => void
  blitzIds?: string[]
  spyIds?: string[]
  snapLocked?: boolean
  carrierVision?: CarrierVision | null
  showFatigue?: boolean
  fatigue?: Record<string, number>
  ownTeam?: TeamPaint
  oppTeam?: TeamPaint
}

function isDLPlayer(id: string)  { return id.startsWith('auto_dl') }
// QB and OL are fully locked; DL can slide horizontally
function isLockedAuto(id: string) { return id.startsWith('auto_') && !isDLPlayer(id) }

export default function GameCanvas({ gameState, positions, onPlayerMove, onSelect, onThrowReceiver, onThrowAtDefender, onScramble, targetReceiverId, routeDepths, onRouteDepthChange, runAngle, runnerId, runnerBounds, manTargets, zoneTypes, zoneCenters, onZoneCenterMove, blitzIds, spyIds, snapLocked, carrierVision, showFatigue, fatigue, ownTeam, oppTeam }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const ballIconRef  = useRef<HTMLDivElement>(null)
  const gameStateRef = useRef(gameState)
  const cameraRef    = useRef<CameraState>(createCamera(25))
  const prevPhaseRef = useRef<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)

  // Snapshot ring buffer for interpolation
  const bufferRef = useRef<SnapshotBuffer>(createBuffer())

  // Latest authoritative positions for hit-testing on tap/drag start
  const latestPositionsRef = useRef<PositionUpdate[]>(positions)

  // While a player is being dragged on the canvas, this holds their live
  // position override so the circle follows the finger before App updates state.
  const canvasDragRef = useRef<{ id: string; x: number; y: number } | null>(null)

  // True for the lifetime of an active player drag. The positions effect must NOT clear the
  // drag override mid-drag — an incoming re-render (e.g. the opponent's pre-snap broadcasts,
  // which the defense receives constantly) would otherwise wipe canvasDragRef, and a pointerup
  // landing in that window would drop the move and snap the player back to its old spot.
  const draggingRef = useRef(false)

  const onPlayerMoveRef = useRef(onPlayerMove)
  onPlayerMoveRef.current = onPlayerMove
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onThrowReceiverRef = useRef(onThrowReceiver)
  onThrowReceiverRef.current = onThrowReceiver
  const onThrowAtDefenderRef = useRef(onThrowAtDefender)
  onThrowAtDefenderRef.current = onThrowAtDefender
  const onScrambleRef = useRef(onScramble)
  onScrambleRef.current = onScramble
  const targetReceiverIdRef = useRef(targetReceiverId ?? null)
  targetReceiverIdRef.current = targetReceiverId ?? null

  const routeDepthsRef = useRef<Record<string, number>>(routeDepths ?? {})
  routeDepthsRef.current = routeDepths ?? {}
  const runAngleRef = useRef(runAngle ?? null)
  runAngleRef.current = runAngle ?? null
  const runnerIdRef = useRef(runnerId ?? null)
  runnerIdRef.current = runnerId ?? null
  const runnerBoundsRef = useRef(runnerBounds ?? null)
  runnerBoundsRef.current = runnerBounds ?? null
  const manTargetsRef = useRef(manTargets ?? {})
  manTargetsRef.current = manTargets ?? {}
  const zoneTypesRef = useRef(zoneTypes ?? {})
  zoneTypesRef.current = zoneTypes ?? {}
  const zoneCentersRef = useRef(zoneCenters ?? {})
  zoneCentersRef.current = zoneCenters ?? {}
  const onZoneCenterMoveRef = useRef(onZoneCenterMove)
  onZoneCenterMoveRef.current = onZoneCenterMove
  const blitzIdsRef = useRef(blitzIds ?? [])
  blitzIdsRef.current = blitzIds ?? []
  const spyIdsRef = useRef(spyIds ?? [])
  spyIdsRef.current = spyIds ?? []
  const snapLockedRef = useRef(snapLocked ?? false)
  snapLockedRef.current = snapLocked ?? false
  const carrierVisionRef = useRef<CarrierVision | null>(carrierVision ?? null)
  carrierVisionRef.current = carrierVision ?? null
  const onRouteDepthChangeRef = useRef(onRouteDepthChange)
  onRouteDepthChangeRef.current = onRouteDepthChange
  const showFatigueRef = useRef(showFatigue ?? false)
  showFatigueRef.current = showFatigue ?? false
  const fatigueRef = useRef<Record<string, number>>(fatigue ?? {})
  fatigueRef.current = fatigue ?? {}
  const ownTeamRef = useRef(ownTeam)
  ownTeamRef.current = ownTeam
  const oppTeamRef = useRef(oppTeam)
  oppTeamRef.current = oppTeam

  // Live route depth drag — mirrors how canvasDragRef works for player drags
  const routeDepthDragRef = useRef<{
    id: string
    startFieldY: number
    startDepth: number
    maxForward: number
    liveDepth: number
  } | null>(null)

  // Zone center drag — defender ID + live canvas position
  const zoneCenterDragRef = useRef<{ defenderId: string; x: number; y: number } | null>(null)

  useEffect(() => { gameStateRef.current = gameState }, [gameState])

  useEffect(() => {
    if (positions.length === 0) return

    // If the set of player IDs changed (player added or removed), wipe the
    // snapshot buffer so no stale frames can ghost a removed player.
    const prevIds = new Set(latestPositionsRef.current.map(p => p.id))
    const playerSetChanged =
      positions.length !== latestPositionsRef.current.length ||
      positions.some(p => !prevIds.has(p.id))
    if (playerSetChanged) {
      bufferRef.current = createBuffer()
    }

    latestPositionsRef.current = positions
    pushSnapshot(bufferRef.current, positions)
    // Only release the drag override when no drag is in flight; clearing it mid-drag would drop
    // the pending move on pointerup (the snap-back bug).
    if (!draggingRef.current) canvasDragRef.current = null
  }, [positions])

  // Keep camera target in sync with game phase
  useEffect(() => {
    if (!gameState) return
    const { phase, yardLine } = gameState

    if (phase === 'pre_snap') {
      // [208] A new play is ready — return the camera to the line of scrimmage, which computeCamera
      // frames at VIEWPORT.LOS_FRAC (~1/3) from the bottom. The first pre-snap of the game snaps so
      // there's no opening drift; after a play we lerp (setCameraTarget) so the return from a
      // downfield carrier-follow ([193]) is smooth rather than a sudden jump.
      if (prevPhaseRef.current === null) {
        snapCamera(cameraRef.current, yardLine)
      }
      setCameraTarget(cameraRef.current, yardLine)
    } else if (phase === 'countdown' || phase === 'dead') {
      setCameraTarget(cameraRef.current, yardLine)
    }

    prevPhaseRef.current = phase
  }, [gameState])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const c: HTMLCanvasElement        = canvas
    const x: CanvasRenderingContext2D = ctx

    let cssW     = 0
    let cssH     = 0
    let rafId    = 0
    let lastTime = 0

    function resize(w: number, h: number) {
      cssW = w
      cssH = h
      const dpr = window.devicePixelRatio || 1
      c.width  = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      x.scale(dpr, dpr)
    }

    const observer = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect
      if (r) resize(r.width, r.height)
    })
    observer.observe(c)
    if (c.clientWidth > 0) resize(c.clientWidth, c.clientHeight)

    // ── Pointer handling ─────────────────────────────────────────────────────
    let dragId: string | null = null
    let dragStartX    = 0    // field X at drag start — clamps DL horizontal shift
    let dragLockedY   = 0    // field Y locked during a DL drag
    let dragLabel     = ''   // position label (WR, RB, etc.) for Y-bound clamping

    function pointerToField(e: PointerEvent) {
      const cam = computeCamera(cssW, cssH, cameraRef.current.currentY)
      return {
        fieldX: (e.offsetX - cam.offsetX) / cam.yardPx,
        fieldY: cam.topRelY - e.offsetY / cam.yardPx,
        cam,
      }
    }

    function clampDragPos(fieldX: number, fieldY: number) {
      if (dragId && isDLPlayer(dragId)) {
        // DL: lock Y, clamp X within ±2 yards of where the drag started
        const lo = Math.max(0.5, dragStartX - 2)
        const hi = Math.min(FIELD.WIDTH - 0.5, dragStartX + 2)
        return { x: Math.max(lo, Math.min(hi, fieldX)), y: dragLockedY }
      }
      if (dragId && dragId === runnerIdRef.current && runnerBoundsRef.current) {
        const b = runnerBoundsRef.current
        return {
          x: Math.max(b.minX, Math.min(b.maxX, fieldX)),
          y: Math.max(b.minY, Math.min(b.maxY, fieldY)),
        }
      }
      const x = Math.max(0.5, Math.min(FIELD.WIDTH - 0.5, fieldX))
      let y = fieldY
      const gs = gameStateRef.current
      if (gs) {
        const { minY, maxY } = getPositionYBounds(dragLabel, gs.role, gs.yardLine)
        y = Math.max(minY, Math.min(maxY, y))
      }
      return { x, y }
    }

    function onPointerDown(e: PointerEvent) {
      if (cssW === 0 || cssH === 0) return
      const { fieldX, fieldY } = pointerToField(e)

      const TAP_YARDS = Math.max(2.0, PLAYER.RADIUS * 2.5)
      let closest: PositionUpdate | null = null
      let minDist = TAP_YARDS

      for (const p of latestPositionsRef.current) {
        const dx   = p.x - fieldX
        const dy   = p.y - fieldY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < minDist) { minDist = dist; closest = p }
      }

      if (closest) {
        selectedIdRef.current = closest.id
        onSelectRef.current?.(closest.id)

        // During a live pass play, tapping one of your receivers throws to them ([165]).
        // App enforces that only the first tap commits (the throw locks afterward, [166]).
        const gs = gameStateRef.current
        if (gs?.phase === 'live' && gs?.role === 'offense' && closest.team === 'o') {
          // Tapping the QB scrambles him; tapping a receiver throws to him.
          if (closest.label === 'QB') {
            onScrambleRef.current?.()
          } else if (closest.label && RECEIVER_LABELS.has(closest.label)) {
            onThrowReceiverRef.current?.(closest.id)
          }
        } else if (gs?.phase === 'live' && gs?.role === 'offense' && closest.team === 'd') {
          // Tapping a defender during a live pass play throws it at him — an immediate interception.
          onThrowAtDefenderRef.current?.(closest.id)
        }

        const offenseLocked = closest.team === 'o' && gameStateRef.current?.phase !== 'pre_snap'
        const defenseLocked = closest.team === 'd' && gameStateRef.current?.phase === 'live'
        if (!isLockedAuto(closest.id) && !offenseLocked && !defenseLocked && !snapLockedRef.current) {
          dragId    = closest.id
          draggingRef.current = true
          dragLabel = closest.label ?? ''
          if (isDLPlayer(closest.id)) {
            dragStartX  = closest.x
            dragLockedY = closest.y
          }
          const clamped = clampDragPos(closest.x, closest.y)
          canvasDragRef.current = { id: closest.id, ...clamped }
          c.setPointerCapture(e.pointerId)
        }
      } else {
        // Check if pointer is on a route depth handle (endpoint ring)
        const gs = gameStateRef.current
        let hitRoute = false
        if (gs?.phase === 'pre_snap' && gs?.role === 'offense') {
          const HANDLE_YARDS = Math.max(2.0, PLAYER.RADIUS * 3)
          for (const p of latestPositionsRef.current) {
            if (!p.route || p.route === 'block' || p.team !== 'o') continue
            if (!p.label || !RECEIVER_LABELS.has(p.label)) continue
            const depth = routeDepthsRef.current[p.id] ?? 1
            const path  = getRoutePath(p.route, p, depth, gs.ballX)
            if (path.length === 0) continue
            const ep   = path[path.length - 1]
            const dx   = ep.x - fieldX
            const dy   = ep.y - fieldY
            if (Math.sqrt(dx * dx + dy * dy) < HANDLE_YARDS) {
              routeDepthDragRef.current = {
                id: p.id,
                startFieldY: fieldY,
                startDepth: depth,
                maxForward: getRouteMaxForward(p.route),
                liveDepth: depth,
              }
              c.setPointerCapture(e.pointerId)
              hitRoute = true
              break
            }
          }
        }
        if (!hitRoute) {
          // Check zone center drag handles (defense only)
          const ZONE_HIT_YARDS = 2.0
          let hitZone = false
          if ((gs?.phase === 'pre_snap' || gs?.phase === 'countdown') && gs?.role === 'defense' && !snapLockedRef.current) {
            for (const [defenderId, center] of Object.entries(zoneCentersRef.current)) {
              const dx = center.x - fieldX
              const dy = center.y - fieldY
              if (Math.sqrt(dx * dx + dy * dy) < ZONE_HIT_YARDS) {
                zoneCenterDragRef.current = { defenderId, x: center.x, y: center.y }
                c.setPointerCapture(e.pointerId)
                hitZone = true
                break
              }
            }
          }
          if (!hitZone) {
            selectedIdRef.current = null
            onSelectRef.current?.(null)
          }
        }
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (dragId) {
        const { fieldX, fieldY } = pointerToField(e)
        const clamped = clampDragPos(fieldX, fieldY)
        canvasDragRef.current = { id: dragId, ...clamped }
      } else if (routeDepthDragRef.current) {
        const { fieldY } = pointerToField(e)
        const { startFieldY, startDepth, maxForward } = routeDepthDragRef.current
        const delta = fieldY - startFieldY
        routeDepthDragRef.current.liveDepth = Math.max(0.3, Math.min(2.5, startDepth + delta / maxForward))
      } else if (zoneCenterDragRef.current) {
        const { fieldX, fieldY } = pointerToField(e)
        zoneCenterDragRef.current.x = Math.max(0.5, Math.min(FIELD.WIDTH - 0.5, fieldX))
        zoneCenterDragRef.current.y = Math.max(0, Math.min(100, fieldY))
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (dragId) {
        const d = canvasDragRef.current
        if (d) onPlayerMoveRef.current?.(d.id, d.x, d.y)
        dragId = null
        draggingRef.current = false
        try { c.releasePointerCapture(e.pointerId) } catch { /* may already be released */ }
      } else if (routeDepthDragRef.current) {
        const { id, liveDepth } = routeDepthDragRef.current
        onRouteDepthChangeRef.current?.(id, liveDepth)
        routeDepthDragRef.current = null
        try { c.releasePointerCapture(e.pointerId) } catch { /* may already be released */ }
      } else if (zoneCenterDragRef.current) {
        const { defenderId, x, y } = zoneCenterDragRef.current
        onZoneCenterMoveRef.current?.(defenderId, x, y)
        zoneCenterDragRef.current = null
        try { c.releasePointerCapture(e.pointerId) } catch { /* may already be released */ }
      }
    }

    c.addEventListener('pointerdown',   onPointerDown)
    c.addEventListener('pointermove',   onPointerMove)
    c.addEventListener('pointerup',     onPointerUp)
    c.addEventListener('pointercancel', onPointerUp)

    // ── RAF loop ──────────────────────────────────────────────────────────────
    function loop(timestamp: number) {
      const dt = lastTime > 0 ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0
      lastTime = timestamp

      stepCamera(cameraRef.current, dt)

      if (cssW > 0 && cssH > 0) {
        const interp = getInterpolated(bufferRef.current, performance.now())

        // While a player is being dragged on canvas, show them at their live
        // drag position rather than the last authoritative position
        const drag = canvasDragRef.current
        const renderPositions = drag
          ? interp.map(p => p.id === drag.id ? { ...p, x: drag.x, y: drag.y } : p)
          : interp

        // Merge live depth drag into the depths map for real-time preview
        const rdDrag = routeDepthDragRef.current
        const effectiveDepths: Record<string, number> = rdDrag
          ? { ...routeDepthsRef.current, [rdDrag.id]: rdDrag.liveDepth }
          : routeDepthsRef.current

        // While a zone center is being dragged, show it at the live position
        const zcd = zoneCenterDragRef.current
        const effectiveZoneCenters = zcd
          ? { ...zoneCentersRef.current, [zcd.defenderId]: { x: zcd.x, y: zcd.y } }
          : zoneCentersRef.current

        drawFrame(
          x, cssW, cssH,
          gameStateRef.current,
          renderPositions,
          cameraRef.current.currentY,
          selectedIdRef.current,
          effectiveDepths,
          runAngleRef.current,
          manTargetsRef.current,
          zoneTypesRef.current,
          effectiveZoneCenters,
          blitzIdsRef.current,
          spyIdsRef.current,
          showFatigueRef.current,
          fatigueRef.current,
          ownTeamRef.current,
          oppTeamRef.current,
        )

        if (gameStateRef.current?.phase === 'live') {
          drawRushVisualizer(x, cssW, cssH, renderPositions, cameraRef.current.currentY)
          drawPassLine(x, cssW, cssH, renderPositions, targetReceiverIdRef.current, cameraRef.current.currentY)
        }

        // Move football icon to ball carrier
        const carrier = renderPositions.find(p => p.state === 'ball')

        // [193] During live play the camera follows whoever has the ball — the designed runner,
        // a scrambling QB, a receiver after the catch, or an intercepting defender on a return.
        // setCameraTarget only nudges the target; stepCamera lerps there, so the move is smooth
        // with no sudden jumps even when possession flips to the returner mid-play.
        if (gameStateRef.current?.phase === 'live' && carrier) {
          setCameraTarget(cameraRef.current, carrier.y)
        }

        const icon    = ballIconRef.current
        if (icon) {
          if (carrier) {
            const cam      = computeCamera(cssW, cssH, cameraRef.current.currentY)
            const r        = Math.max(4, cam.yardPx * PLAYER.RADIUS)
            const iconSize = Math.max(12, r * 1.4)
            const bx       = cam.offsetX + carrier.x * cam.yardPx
            const by       = (cam.topRelY - carrier.y) * cam.yardPx
            icon.style.display  = 'block'
            icon.style.fontSize = `${iconSize}px`
            // Tuck the ball at the carrier's bottom-right hip, not ahead of them — keeps the
            // running lane in front of the carrier unobstructed.
            icon.style.left     = `${bx + r * 0.3}px`
            icon.style.top      = `${by + r * 0.3}px`
          } else {
            icon.style.display = 'none'
          }
        }
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      c.removeEventListener('pointerdown',   onPointerDown)
      c.removeEventListener('pointermove',   onPointerMove)
      c.removeEventListener('pointerup',     onPointerUp)
      c.removeEventListener('pointercancel', onPointerUp)
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{
          display:     'block',
          width:       '100%',
          height:      '100%',
          touchAction: 'none',
        }}
      />
      <div ref={ballIconRef} className="ball-indicator" style={{ display: 'none' }}>
        <FaFootballBall />
      </div>
    </div>
  )
}
