import { FIELD, VIEWPORT, PLAYER } from '../constants/simulation.ts'
import type { GameState, PositionUpdate, CarrierVision } from '../types/game.ts'
import { getRoutePath } from './routePaths.ts'
import { ZONE_CONFIGS } from './zones.ts'

const RECEIVER_LABELS = new Set(['WR', 'TE', 'RB'])

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  FIELD_EVEN:    '#2e7d32',
  FIELD_ODD:     '#388e3c',
  OWN_EZ:        '#1b5e20',
  OPP_EZ:        '#33691e',
  LINE:          'rgba(255,255,255,0.50)',
  GOAL_LINE:     '#ffffff',
  LOS:           '#42a5f5',
  FIRST_DOWN:    '#ffd600',
  // Player fills
  OFFENSE:       '#1e88e5',  // blue
  DEFENSE:       '#e53935',  // red
  BALL_CARRIER:  '#f59e0b',  // amber — whoever currently has the ball
  OPEN:          '#43a047',  // green — receiver with no defender near them
  CONTESTED:     '#fdd835',  // yellow — defender close but not locked on
  COVERED:       '#e53935',  // red — receiver completely smothered
  // Player decoration
  PLAYER_RING:   '#ffffff',  // default ring
  SELECTED_RING: '#facc15',  // bright yellow ring — selected/placing player
  PLAYER_LABEL:  '#ffffff',
  BG:            '#111111',
}

// ── Camera ────────────────────────────────────────────────────────────────────
//
// The renderer works in offense-relative yard space:
//   relY  0   = own goal line       relY  100 = opponent goal line
//   relY -10  = back of own EZ      relY  110 = back of opponent EZ
//
// yardPx is the smaller of two constraints so both axes always fit on screen:
//   cssW / FIELD.WIDTH              — never clip the field horizontally
//   cssH / TARGET_VISIBLE_YARDS     — target ~33 yards top-to-bottom
// On landscape/wide screens the height constraint wins; the field is centered
// horizontally with dark pillarbox bars.  On narrow/portrait screens the width
// constraint wins, the full field fills side-to-side, and more yards are visible
// vertically than the target.

interface Camera {
  bottomRelY: number   // relY at the very bottom of the canvas
  topRelY:    number   // relY at the very top of the canvas
  yardPx:     number   // CSS pixels per yard
  offsetX:    number   // CSS pixels from left canvas edge to left sideline
}

export function computeCamera(cssW: number, cssH: number, losYardLine: number): Camera {
  // Landscape-primary: height constraint gives ~33 yards in landscape and the
  // field fits comfortably with dark pillarbox bars on the sides.  In portrait
  // the width constraint wins instead, keeping the full field visible
  // side-to-side at the cost of showing more yards vertically.
  const yardPx     = Math.min(cssW / FIELD.WIDTH, cssH / VIEWPORT.TARGET_VISIBLE_YARDS)
  const offsetX    = (cssW - FIELD.WIDTH * yardPx) / 2
  const totalYards = cssH / yardPx

  let bottomRelY = losYardLine - totalYards * VIEWPORT.LOS_FRAC
  bottomRelY = Math.max(-10, Math.min(110 - totalYards, bottomRelY))

  return { bottomRelY, topRelY: bottomRelY + totalYards, yardPx, offsetX }
}

// ── Coordinate helpers ────────────────────────────────────────────────────────

function relYToCanvas(relY: number, cam: Camera): number {
  return (cam.topRelY - relY) * cam.yardPx
}

function fieldXToCanvas(x: number, cam: Camera): number {
  return cam.offsetX + x * cam.yardPx
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function hLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  x1: number,
  x2: number,
  lineWidth: number,
  dash: number[] = [],
) {
  ctx.lineWidth = lineWidth
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
  ctx.setLineDash([])
}

// ── Field drawing ─────────────────────────────────────────────────────────────

function drawField(ctx: CanvasRenderingContext2D, cam: Camera, cssH: number) {
  const x1     = cam.offsetX
  const fieldW = FIELD.WIDTH * cam.yardPx
  const x2     = x1 + fieldW

  // Alternating 5-yard strips
  const startBand = Math.floor(cam.bottomRelY / 5) * 5
  for (let band = startBand; band < cam.topRelY + 5; band += 5) {
    const yTop    = relYToCanvas(band + 5, cam)
    const yBottom = relYToCanvas(band, cam)
    const idx     = Math.floor((band + 10) / 5)
    ctx.fillStyle = idx % 2 === 0 ? C.FIELD_EVEN : C.FIELD_ODD
    ctx.fillRect(x1, yTop, fieldW, yBottom - yTop)
  }

  // End zones
  ctx.fillStyle = C.OWN_EZ
  ctx.fillRect(x1, relYToCanvas(0, cam), fieldW, relYToCanvas(-10, cam) - relYToCanvas(0, cam))
  ctx.fillStyle = C.OPP_EZ
  ctx.fillRect(x1, relYToCanvas(110, cam), fieldW, relYToCanvas(100, cam) - relYToCanvas(110, cam))

  // 5-yard lines
  ctx.strokeStyle = C.LINE
  for (let yl = 5; yl < 100; yl += 5) {
    const cy = relYToCanvas(yl, cam)
    if (cy < -2 || cy > cssH + 2) continue
    hLine(ctx, cy, x1, x2, yl % 10 === 0 ? 1.5 : 0.75)
  }

  // Goal lines
  ctx.strokeStyle = C.GOAL_LINE
  const ownGoalY = relYToCanvas(0, cam)
  if (ownGoalY >= -2 && ownGoalY <= cssH + 2) hLine(ctx, ownGoalY, x1, x2, 2)
  const oppGoalY = relYToCanvas(100, cam)
  if (oppGoalY >= -2 && oppGoalY <= cssH + 2) hLine(ctx, oppGoalY, x1, x2, 2)

  // Yard numbers — side columns, rotated to face nearest sideline
  const numSize  = Math.max(8, cam.yardPx * 2.5)
  const numLeftX = fieldXToCanvas(2, cam)
  const numRightX= fieldXToCanvas(FIELD.WIDTH - 2, cam)
  ctx.font         = `bold ${numSize}px sans-serif`
  ctx.fillStyle    = C.LINE
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  for (let yl = 10; yl < 100; yl += 10) {
    const cy = relYToCanvas(yl, cam)
    if (cy < -numSize || cy > cssH + numSize) continue
    const label = String(yl <= 50 ? yl : 100 - yl)
    ctx.save()
    ctx.translate(numLeftX, cy)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(label, 0, 0)
    ctx.restore()
    ctx.save()
    ctx.translate(numRightX, cy)
    ctx.rotate(Math.PI / 2)
    ctx.fillText(label, 0, 0)
    ctx.restore()
  }
  ctx.textBaseline = 'alphabetic'

  // Yard tick marks — every yard, 4 columns, batched into one stroke()
  const tickLen = cam.yardPx * 0.2
  const tickX   = [
    fieldXToCanvas(2, cam),
    fieldXToCanvas(FIELD.WIDTH * 0.35, cam),
    fieldXToCanvas(FIELD.WIDTH * 0.65, cam),
    fieldXToCanvas(FIELD.WIDTH - 2, cam),
  ]
  ctx.strokeStyle = C.LINE
  ctx.lineWidth   = 1.5
  ctx.beginPath()
  for (let yl = 0; yl <= 100; yl++) {
    if (yl % 5 === 0) continue  // 5-yard lines already drawn above
    const cy = relYToCanvas(yl, cam)
    if (cy < -2 || cy > cssH + 2) continue
    for (const tx of tickX) {
      ctx.moveTo(tx - tickLen, cy)
      ctx.lineTo(tx + tickLen, cy)
    }
  }
  ctx.stroke()

  // Sidelines
  ctx.strokeStyle = C.GOAL_LINE
  ctx.lineWidth   = 2
  ctx.beginPath()
  ctx.moveTo(x1 + 1, 0); ctx.lineTo(x1 + 1, cssH)
  ctx.moveTo(x2 - 1, 0); ctx.lineTo(x2 - 1, cssH)
  ctx.stroke()
}

// ── LOS and first-down marker ─────────────────────────────────────────────────

function drawLos(ctx: CanvasRenderingContext2D, cam: Camera, cssH: number, yardLine: number) {
  const cy = relYToCanvas(yardLine, cam)
  if (cy < 0 || cy > cssH) return
  ctx.strokeStyle = C.LOS
  hLine(ctx, cy, cam.offsetX, cam.offsetX + FIELD.WIDTH * cam.yardPx, 2, [8, 5])
}

function drawFirstDown(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  cssH: number,
  yardLine: number,
  distance: number,
) {
  const fdYardLine = yardLine + distance
  if (fdYardLine >= 100) return
  const cy = relYToCanvas(fdYardLine, cam)
  if (cy < 0 || cy > cssH) return
  ctx.strokeStyle = C.FIRST_DOWN
  hLine(ctx, cy, cam.offsetX, cam.offsetX + FIELD.WIDTH * cam.yardPx, 2, [6, 5])
}

// ── Players ───────────────────────────────────────────────────────────────────

// Openness thresholds ([169]): a pass catcher is colored red (smothered), yellow (mildly
// covered), or green (open) by its server-computed openness score in [0, 1].
const OPENNESS_OPEN_MIN = 0.66   // ≥ this → open (green)
const OPENNESS_MILD_MIN = 0.33   // ≥ this → mildly covered (yellow); below → covered (red)

function opennessFill(openness: number): string {
  if (openness >= OPENNESS_OPEN_MIN) return C.OPEN
  if (openness >= OPENNESS_MILD_MIN) return C.CONTESTED
  return C.COVERED
}

function playerFill(p: PositionUpdate, colorByOpenness: boolean): string {
  // During a live pass play, color the offense's own pass catchers by how open they are ([169]).
  if (colorByOpenness && typeof p.openness === 'number') return opennessFill(p.openness)
  switch (p.state) {
    case 'ball':       return C.BALL_CARRIER
    case 'open':       return C.OPEN
    case 'contested':  return C.CONTESTED
    case 'covered':    return C.COVERED
    default:           return p.team === 'o' ? C.OFFENSE : C.DEFENSE
  }
}

// Players that never carry fatigue (linemen + QB) — never get a stamina bar.
const NO_FATIGUE_LABELS = new Set(['QB', 'OL', 'C', 'G', 'T', 'DL'])

// Linemen keep their POSITION on the field; everyone else shows their last name.
const POSITION_LABEL_ONLY = new Set(['OL', 'C', 'G', 'T', 'DL', 'DE', 'DT', 'NT'])

// [294] Trace a 5-pointed star path of radius r centred at (cx, cy) — used in place of the body
// circle for a player with an active X-Factor.
function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const inner = r * 0.5
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner
    const ang = -Math.PI / 2 + (i * Math.PI) / 5
    const x = cx + Math.cos(ang) * rad
    const y = cy + Math.sin(ang) * rad
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

// Generational suffixes that aren't a player's last name — keep the name in front of them.
const NAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v'])

// The text drawn under a player: their last name, or the position for linemen / when no name is set.
// If the last token is a suffix (Jr., III…) include the preceding word, e.g. "Etienne Jr.".
function fieldLabel(p: PositionUpdate): string {
  const pos = p.label ?? ''
  if (p.name && !POSITION_LABEL_ONLY.has(pos)) {
    const parts = p.name.trim().split(/\s+/)
    let last = parts[parts.length - 1]
    if (parts.length >= 2 && NAME_SUFFIXES.has(last.toLowerCase())) {
      last = `${parts[parts.length - 2]} ${last}`
    }
    return last
  }
  return pos
}

function drawPlayers(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  cssH: number,
  positions: PositionUpdate[],
  selectedId: string | null,
  colorByOpenness: boolean,
  showFatigue = false,
  fatigue: Record<string, number> = {},
) {
  const r          = Math.max(4, cam.yardPx * PLAYER.RADIUS)
  const innerSize  = Math.max(8, r * 1.3)   // O / X inside circle
  const labelSize  = Math.max(6, r * 0.8)   // position label below circle
  const showInner  = r >= 5   // always show O/X when circle is big enough
  const showLabel  = r >= 5   // show position label whenever O/X is shown

  ctx.textAlign = 'center'

  for (const p of positions) {
    const cx = fieldXToCanvas(p.x, cam)
    const cy = relYToCanvas(p.y, cam)
    if (cy < -r || cy > cssH + r) continue

    // Client selection OR server-flagged selected state both trigger the ring
    const selected = p.id === selectedId || p.state === 'selected'

    // Collision boundary ring — drawn first so the body circle sits on top
    const cr = r + Math.max(3, cam.yardPx * 0.2)
    ctx.beginPath()
    ctx.arc(cx, cy, cr, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth   = 1
    ctx.setLineDash([3, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // Body — a star for an active X-Factor ([294]), otherwise a circle.
    if (p.xfActive) {
      ctx.save()
      ctx.shadowColor = '#ffd24a'
      ctx.shadowBlur  = Math.max(6, cam.yardPx * 0.5)
      starPath(ctx, cx, cy, r * 1.35)
      ctx.fillStyle   = playerFill(p, colorByOpenness)
      ctx.strokeStyle = '#ffd24a'
      ctx.lineWidth   = selected ? 3 : 2
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    } else {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle   = playerFill(p, colorByOpenness)
      ctx.strokeStyle = selected ? C.SELECTED_RING : C.PLAYER_RING
      ctx.lineWidth   = selected ? 3 : 1.5
      ctx.fill()
      ctx.stroke()
    }

    if (!showInner) continue

    // O / X centered inside circle
    ctx.font         = `bold ${innerSize}px sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = '#ffffff'
    ctx.fillText(p.team === 'o' ? 'O' : 'X', cx, cy)

    // Name/position label below circle — last name for skill players, position for OL/DL.
    const labelText = fieldLabel(p)
    if (showLabel && labelText) {
      const labelY = cy + r + 3
      ctx.font         = `bold ${labelSize}px sans-serif`
      ctx.textBaseline = 'top'
      ctx.strokeStyle  = 'rgba(0,0,0,0.75)'
      ctx.lineWidth    = 2.5
      ctx.strokeText(labelText, cx, labelY)
      ctx.fillStyle    = C.PLAYER_LABEL
      ctx.fillText(labelText, cx, labelY)
    }

    // Fatigue bar — below the label, for every fatigued player (skips linemen/QB, which carry no
    // stamina). Only when the Fatigue view is toggled on.
    if (showFatigue && p.label && !NO_FATIGUE_LABELS.has(p.label)) {
      const stamina = fatigue[p.id]
      if (typeof stamina === 'number') {
        drawFatigueBar(ctx, cx, cy + r + labelSize + 8, r, stamina)
      }
    }
  }
}

// A small stamina bar: green when fresh, amber as it wears, red when gassed. stamina is 0–100.
function drawFatigueBar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  r: number,
  stamina: number,
) {
  const w    = Math.max(12, r * 2.4)
  const h    = Math.max(3, r * 0.35)
  const x    = cx - w / 2
  const frac = Math.max(0, Math.min(1, stamina / 100))

  // Backing plate for contrast on grass
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(x - 1, top - 1, w + 2, h + 2)

  ctx.fillStyle = frac > 0.6 ? C.OPEN : frac > 0.3 ? C.CONTESTED : C.COVERED
  ctx.fillRect(x, top, w * frac, h)
}

// ── Route paths ───────────────────────────────────────────────────────────────

// On a RUN play the offense's route art reflects run assignments, drawn gray to read as "not a
// live route": every WR shows a gray go, and every TE — plus any TE/RB explicitly set to block —
// shows a gray upside-down-T block marker. On a pass play, assigned routes draw in yellow.
function drawRoutes(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  positions: PositionUpdate[],
  selectedId: string | null,
  routeDepths: Record<string, number>,
  isRun: boolean,
) {
  const GRAY = 'rgba(170,170,170,0.75)'
  for (const p of positions) {
    if (p.team !== 'o' || !p.label) continue

    // Gray block marker (⊥): a TE/RB set to block on any play, or every TE on a run.
    const blocks = (p.route === 'block' && (p.label === 'TE' || p.label === 'RB'))
                || (isRun && p.label === 'TE')
    if (blocks) { drawBlockMarker(ctx, cam, p, GRAY); continue }

    // Run play: every WR runs a gray go route.
    if (isRun && p.label === 'WR') {
      drawRoutePath(ctx, cam, p, getRoutePath('go', p, 0.5), GRAY, p.id === selectedId ? 2.5 : 1.5)
      continue
    }

    // Pass play: draw the assigned route in yellow (block handled above).
    if (!isRun && p.route && p.route !== 'block' && RECEIVER_LABELS.has(p.label)) {
      const sel = p.id === selectedId
      drawRoutePath(ctx, cam, p, getRoutePath(p.route, p, routeDepths[p.id] ?? 1),
        `rgba(250,204,21,${sel ? 0.9 : 0.5})`, sel ? 2.5 : 1.5)
    }
  }
}

// Polyline from the player through the route waypoints, capped with an arrowhead.
function drawRoutePath(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  p: PositionUpdate,
  path: { x: number; y: number }[],
  color: string,
  lineW: number,
) {
  if (path.length === 0) return
  const sx = fieldXToCanvas(p.x, cam)
  const sy = relYToCanvas(p.y, cam)

  ctx.strokeStyle = color
  ctx.lineWidth   = lineW
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  for (const wp of path) ctx.lineTo(fieldXToCanvas(wp.x, cam), relYToCanvas(wp.y, cam))
  ctx.stroke()

  const last  = path[path.length - 1]
  const prev  = path.length > 1 ? path[path.length - 2] : p
  const ex    = fieldXToCanvas(last.x, cam)
  const ey    = relYToCanvas(last.y, cam)
  const px    = fieldXToCanvas(prev.x, cam)
  const py    = relYToCanvas(prev.y, cam)
  const angle = Math.atan2(ey - py, ex - px)
  const alen  = Math.max(6, cam.yardPx * 0.45)
  const afan  = Math.PI / 5

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - alen * Math.cos(angle - afan), ey - alen * Math.sin(angle - afan))
  ctx.lineTo(ex - alen * Math.cos(angle + afan), ey - alen * Math.sin(angle + afan))
  ctx.closePath()
  ctx.fill()
}

// Upside-down-T (⊥) block marker: a base bar at the blocker with a short stem upfield.
function drawBlockMarker(ctx: CanvasRenderingContext2D, cam: Camera, p: PositionUpdate, color: string) {
  const cx   = fieldXToCanvas(p.x, cam)
  const cy   = relYToCanvas(p.y - 2.2, cam)
  const half = Math.max(5, cam.yardPx * 0.9)   // base bar half-width
  const stem = Math.max(6, cam.yardPx * 2.4)   // stem reaching upfield

  ctx.strokeStyle = color
  ctx.lineWidth   = Math.max(2, cam.yardPx * 0.2)
  ctx.lineCap     = 'round'
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(cx - half, cy); ctx.lineTo(cx + half, cy)   // base bar, perpendicular to the play
  ctx.moveTo(cx, cy);        ctx.lineTo(cx, cy - stem)   // stem upfield (forward = up)
  ctx.stroke()
  ctx.lineCap = 'butt'
}

// ── Run direction arrow ───────────────────────────────────────────────────────

function drawRunDirection(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  positions: PositionUpdate[],
  angleDeg: number,
) {
  const rbs = positions.filter(p => p.label === 'RB' && p.team === 'o')
  if (rbs.length === 0) return

  const color    = 'rgba(255,255,255,0.92)'
  const angleRad = (angleDeg * Math.PI) / 180
  const length   = 6  // yards

  for (const rb of rbs) {
    const cx = fieldXToCanvas(rb.x, cam)
    const cy = relYToCanvas(rb.y, cam)
    const ex = cx + Math.sin(angleRad) * length * cam.yardPx
    const ey = cy - Math.cos(angleRad) * length * cam.yardPx

    ctx.strokeStyle = color
    ctx.lineWidth   = 3
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()

    const angle = Math.atan2(ey - cy, ex - cx)
    const alen  = Math.max(8, cam.yardPx * 0.6)
    const afan  = Math.PI / 5

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - alen * Math.cos(angle - afan), ey - alen * Math.sin(angle - afan))
    ctx.lineTo(ex - alen * Math.cos(angle + afan), ey - alen * Math.sin(angle + afan))
    ctx.closePath()
    ctx.fill()
  }
}

// ── Zone coverage areas ───────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function drawZones(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  positions: PositionUpdate[],
  zoneTypes: Record<string, string>,
  zoneCenters: Record<string, { x: number; y: number }>,
  losY: number,
) {
  const posMap = new Map(positions.map(p => [p.id, p]))

  for (const [defenderId, zoneType] of Object.entries(zoneTypes)) {
    const cfg    = ZONE_CONFIGS[zoneType as keyof typeof ZONE_CONFIGS]
    const center = zoneCenters[defenderId]
    if (!cfg || !center) continue

    const rotated = cfg.rotation !== 0
    // After rotation=π/2: halfWidthYards (rx) becomes the vertical extent,
    //                      halfDepthYards (ry) becomes the horizontal extent.
    // Clamp accordingly so zones never cross the LOS or sidelines.
    const maxDownfield = Math.max(0, center.y - losY)
    let crx: number, cry: number
    if (rotated) {
      crx = Math.max(0.5, Math.min(cfg.halfWidthYards, maxDownfield, center.y + 10, 110 - center.y))
      cry = Math.max(0.5, Math.min(cfg.halfDepthYards, center.x, FIELD.WIDTH - center.x))
    } else {
      crx = Math.max(0.5, Math.min(cfg.halfWidthYards, center.x, FIELD.WIDTH - center.x))
      cry = Math.max(0.5, Math.min(cfg.halfDepthYards, maxDownfield, center.y + 10, 110 - center.y))
    }
    // Preserve orientation: clipping must never flip a vertical oval horizontal or vice versa
    if (cfg.halfDepthYards > cfg.halfWidthYards) cry = Math.max(cry, crx)  // keep taller than wide
    if (cfg.halfWidthYards > cfg.halfDepthYards) crx = Math.max(crx, cry)  // keep wider than tall

    const cx   = fieldXToCanvas(center.x, cam)
    const cy   = relYToCanvas(center.y, cam)
    const rxPx = crx * cam.yardPx
    const ryPx = cry * cam.yardPx

    // Line from defender to zone center (same color as zone, matches man-coverage line style)
    const def = posMap.get(defenderId)
    if (def) {
      const dx = fieldXToCanvas(def.x, cam)
      const dy = relYToCanvas(def.y, cam)
      ctx.strokeStyle = hexToRgba(cfg.color, 0.60)
      ctx.lineWidth   = 1.5
      ctx.setLineDash([4, 5])
      ctx.beginPath()
      ctx.moveTo(dx, dy)
      ctx.lineTo(cx, cy)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Zone fill
    ctx.beginPath()
    ctx.ellipse(cx, cy, rxPx, ryPx, cfg.rotation, 0, Math.PI * 2)
    ctx.fillStyle = hexToRgba(cfg.color, 0.18)
    ctx.fill()

    // Dashed outline
    ctx.strokeStyle = hexToRgba(cfg.strokeColor, 0.70)
    ctx.lineWidth   = 1.5
    ctx.setLineDash([5, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // Zone center drag handle — small filled dot
    const handleR = Math.max(4, cam.yardPx * 0.35)
    ctx.beginPath()
    ctx.arc(cx, cy, handleR, 0, Math.PI * 2)
    ctx.fillStyle   = hexToRgba(cfg.color, 0.85)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth   = 1.5
    ctx.stroke()
  }
}

// ── Man coverage lines ────────────────────────────────────────────────────────

function drawManCoverage(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  positions: PositionUpdate[],
  manTargets: Record<string, string>,
) {
  const posMap = new Map(positions.map(p => [p.id, p]))
  ctx.strokeStyle = 'rgba(200,200,200,0.55)'
  ctx.lineWidth   = 1.5
  ctx.setLineDash([4, 5])
  for (const [defenderId, targetId] of Object.entries(manTargets)) {
    const def = posMap.get(defenderId)
    const tgt = posMap.get(targetId)
    if (!def || !tgt) continue
    ctx.beginPath()
    ctx.moveTo(fieldXToCanvas(def.x, cam), relYToCanvas(def.y, cam))
    ctx.lineTo(fieldXToCanvas(tgt.x, cam), relYToCanvas(tgt.y, cam))
    ctx.stroke()
  }
  ctx.setLineDash([])
}

// ── Blitz indicators ─────────────────────────────────────────────────────────

function drawBlitz(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  positions: PositionUpdate[],
  blitzIds: string[],
) {
  if (blitzIds.length === 0) return
  const blitzSet = new Set(blitzIds)
  const color    = '#ef4444'
  const alen     = Math.max(6, cam.yardPx * 0.5)
  const afan     = Math.PI / 5

  // Arrow points toward the QB; fall back to straight downfield if no QB on field
  const qb = positions.find(p => p.label === 'QB' && p.team === 'o')

  for (const p of positions) {
    if (!blitzSet.has(p.id)) continue
    const cx = fieldXToCanvas(p.x, cam)
    const cy = relYToCanvas(p.y, cam)

    const ARROW_YARDS = 5
    let angle: number
    if (qb) {
      angle = Math.atan2(relYToCanvas(qb.y, cam) - cy, fieldXToCanvas(qb.x, cam) - cx)
    } else {
      angle = Math.PI / 2  // fallback: straight toward offense (down-canvas = positive y)
    }
    const ex = cx + Math.cos(angle) * ARROW_YARDS * cam.yardPx
    const ey = cy + Math.sin(angle) * ARROW_YARDS * cam.yardPx

    ctx.strokeStyle = color
    ctx.lineWidth   = 2.5
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - alen * Math.cos(angle - afan), ey - alen * Math.sin(angle - afan))
    ctx.lineTo(ex - alen * Math.cos(angle + afan), ey - alen * Math.sin(angle + afan))
    ctx.closePath()
    ctx.fill()
  }
}

// ── Spy indicators ───────────────────────────────────────────────────────────
//
// Draws a targeting reticle (dotted amber ring + crosshair) around each spy.
// Spies are stationary pre-snap; live-play logic will add scramble pursuit.

function drawSpy(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  positions: PositionUpdate[],
  spyIds: string[],
) {
  if (spyIds.length === 0) return
  const spySet = new Set(spyIds)
  const color  = '#f59e0b'  // amber

  for (const p of positions) {
    if (!spySet.has(p.id)) continue
    const cx = fieldXToCanvas(p.x, cam)
    const cy = relYToCanvas(p.y, cam)
    const r  = Math.max(12, cam.yardPx * 1.2)

    // Dotted outer ring
    ctx.strokeStyle = `${color}99`
    ctx.lineWidth   = 1.5
    ctx.setLineDash([2, 4])
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Short crosshair lines
    const arm = r * 0.4
    ctx.strokeStyle = `${color}cc`
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy)
    ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm)
    ctx.stroke()
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  gameState: GameState | null,
  positions: PositionUpdate[],
  cameraY: number,
  selectedId: string | null,
  routeDepths: Record<string, number> = {},
  runAngle: number | null = null,
  manTargets: Record<string, string> = {},
  zoneTypes: Record<string, string> = {},
  zoneCenters: Record<string, { x: number; y: number }> = {},
  blitzIds: string[] = [],
  spyIds: string[] = [],
  showFatigue = false,
  fatigue: Record<string, number> = {},
) {
  ctx.fillStyle = C.BG
  ctx.fillRect(0, 0, cssW, cssH)

  const cam = computeCamera(cssW, cssH, cameraY)

  drawField(ctx, cam, cssH)

  if (gameState) {
    drawLos(ctx, cam, cssH, gameState.yardLine)
    drawFirstDown(ctx, cam, cssH, gameState.yardLine, gameState.distance)
  }

  // Design overlays (routes, run direction, coverage) stay up through the hike countdown, not just
  // pre-snap, so the offense's run angle/routes and the defense's coverage remain visible after the
  // formation is set. (The run arrow is gated to the offense via the runAngle prop; each side only
  // has its own design data, so neither sees the other's.)
  if (gameState?.phase === 'pre_snap' || gameState?.phase === 'countdown') {
    const losY = gameState?.yardLine ?? 0
    if (Object.keys(zoneTypes).length > 0) drawZones(ctx, cam, positions, zoneTypes, zoneCenters, losY)
    // runAngle is non-null only for the offense on a run play, so it doubles as the run-play flag.
    drawRoutes(ctx, cam, positions, selectedId, routeDepths, runAngle !== null)
    if (runAngle !== null) drawRunDirection(ctx, cam, positions, runAngle)
    if (Object.keys(manTargets).length > 0) drawManCoverage(ctx, cam, positions, manTargets)
    drawBlitz(ctx, cam, positions, blitzIds)
    drawSpy(ctx, cam, positions, spyIds)
  }
  // Color the offense's own pass catchers by openness during a live pass play ([169]).
  const colorByOpenness = gameState?.role === 'offense' && gameState?.phase === 'live'
  drawPlayers(ctx, cam, cssH, positions, selectedId, colorByOpenness, showFatigue, fatigue)
}

// ── Pass-rush visualizer ──────────────────────────────────────────────────────
//
// Debug overlay drawn during live play.  Shows:
//   • Outer dashed ring — pressure radius (3 yds): defenders here hurt accuracy
//   • Inner solid ring  — sack zone (1 yd): defender here triggers a sack
//   • Dashed vertical lanes for the two outermost defenders (contain responsibility)
//
// Coordinates match the server constants in pressureDetection.js / sackDetection.js.

const RUSH_VIZ_PRESSURE_RADIUS = 3.0  // yards — must match server PRESSURE_RADIUS
const RUSH_VIZ_SACK_RADIUS     = 1.0  // yards — must match server SACK_RADIUS

export function drawRushVisualizer(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  positions: PositionUpdate[],
  cameraY: number,
) {
  const cam = computeCamera(cssW, cssH, cameraY)

  const qb = positions.find(p => p.id === 'auto_qb' && p.team === 'o')
  if (!qb) return

  const qbPx = fieldXToCanvas(qb.x, cam)
  const qbPy = relYToCanvas(qb.y, cam)

  ctx.save()

  // Pressure radius — dashed yellow ring
  ctx.strokeStyle = 'rgba(255, 220, 0, 0.45)'
  ctx.lineWidth   = 1.5
  ctx.setLineDash([5, 5])
  ctx.beginPath()
  ctx.arc(qbPx, qbPy, RUSH_VIZ_PRESSURE_RADIUS * cam.yardPx, 0, Math.PI * 2)
  ctx.stroke()

  // Sack zone — solid red ring
  ctx.strokeStyle = 'rgba(255, 60, 60, 0.75)'
  ctx.lineWidth   = 1.5
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.arc(qbPx, qbPy, RUSH_VIZ_SACK_RADIUS * cam.yardPx, 0, Math.PI * 2)
  ctx.stroke()

  // Contain lanes — dashed vertical guides for the two outermost defenders
  const defenders = positions.filter(p => p.team === 'd')
  if (defenders.length >= 2) {
    const sorted    = [...defenders].sort((a, b) => a.x - b.x)
    const leftEdge  = sorted[0]
    const rightEdge = sorted[sorted.length - 1]

    ctx.strokeStyle = 'rgba(255, 150, 50, 0.55)'
    ctx.lineWidth   = 1
    ctx.setLineDash([4, 4])

    const drawLane = (defender: PositionUpdate) => {
      const dx = fieldXToCanvas(defender.x, cam)
      ctx.beginPath()
      ctx.moveTo(dx, relYToCanvas(defender.y, cam))
      ctx.lineTo(dx, qbPy)
      ctx.stroke()
    }

    drawLane(leftEdge)
    if (rightEdge.id !== leftEdge.id) drawLane(rightEdge)
  }

  ctx.restore()
}

// ── Running visualizer ([163]) ────────────────────────────────────────────────
//
// Debug overlay for the ball carrier's vision raycast: draws every evaluated lane as
// a ray from the carrier (length = clear distance ahead), colored by how open it is
// (green = open, red = clogged), with the chosen lane highlighted in cyan. Ray
// directions arrive in the offense-relative frame (forward = +y), so they draw directly.

const RUN_VIZ_MAX_CLEAR = 15   // yards — matches the server's RAY_MAX, for color scaling

export function drawRunningVisualizer(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  positions: PositionUpdate[],
  vision: CarrierVision | null,
  cameraY: number,
) {
  if (!vision) return
  const carrier = positions.find(p => p.id === vision.id)
  if (!carrier) return

  const cam = computeCamera(cssW, cssH, cameraY)
  const cx  = fieldXToCanvas(carrier.x, cam)
  const cy  = relYToCanvas(carrier.y, cam)

  ctx.save()
  ctx.setLineDash([])

  // Non-selected rays first, then the selected one on top.
  const ordered = [...vision.rays].sort((a, b) => Number(a.selected) - Number(b.selected))
  for (const ray of ordered) {
    const ex = fieldXToCanvas(carrier.x + ray.dx * ray.clear, cam)
    const ey = relYToCanvas(carrier.y + ray.dy * ray.clear, cam)

    const t   = Math.min(1, ray.clear / RUN_VIZ_MAX_CLEAR)   // 0 (clogged) … 1 (open)
    const col = ray.selected
      ? 'rgba(80, 200, 255, 0.95)'
      : `rgba(${Math.round(255 * (1 - t))}, ${Math.round(190 * t + 40)}, 60, 0.6)`

    ctx.strokeStyle = col
    ctx.lineWidth   = ray.selected ? 3.5 : 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()

    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(ex, ey, ray.selected ? 4.5 : 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

// ── Pass line ([168]) ───────────────────────────────────────────────────────────
//
// A white dashed line from the quarterback to the targeted receiver, shown once a throw
// target has been chosen — quick visual feedback for where the pass is going.
export function drawPassLine(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  positions: PositionUpdate[],
  targetReceiverId: string | null,
  cameraY: number,
) {
  if (!targetReceiverId) return
  const qb       = positions.find(p => p.team === 'o' && p.label === 'QB')
  const receiver = positions.find(p => p.id === targetReceiverId)
  if (!qb || !receiver) return

  const cam = computeCamera(cssW, cssH, cameraY)

  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth   = 2
  ctx.setLineDash([6, 5])
  ctx.beginPath()
  ctx.moveTo(fieldXToCanvas(qb.x, cam), relYToCanvas(qb.y, cam))
  ctx.lineTo(fieldXToCanvas(receiver.x, cam), relYToCanvas(receiver.y, cam))
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}
