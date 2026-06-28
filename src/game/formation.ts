import type { PositionUpdate } from '../types/game.ts'
import { FIELD } from '../constants/simulation.ts'

const MID = FIELD.WIDTH / 2  // 26.665 — center of the field

// ── Offense ───────────────────────────────────────────────────────────────────
//
// The offensive line locks on the LOS.  Standard 5-man spread:
//   C at center, guards 1.5 yd out, tackles 3.0 yd out.
// QB lines up in shotgun, 5 yards behind the LOS.
//
// [hash] centerX is the lateral ball spot for this snap (a hash mark, or midfield). The whole auto
// formation is built around it so it lines up on the spotted ball; defaults to midfield.

export function getOLQBPlayers(yardLine: number, centerX: number = MID): PositionUpdate[] {
  return offenseAutoPlaced(yardLine, centerX)
}

export function getDLPlayers(yardLine: number, centerX: number = MID): PositionUpdate[] {
  return defenseAutoPlaced(yardLine, centerX)
}

function offenseAutoPlaced(yardLine: number, centerX: number = MID): PositionUpdate[] {
  return [
    { id: 'auto_ol_lt', x: centerX - 3.5,  y: yardLine - 1, team: 'o', label: 'OL' },
    { id: 'auto_ol_lg', x: centerX - 1.75, y: yardLine - 1, team: 'o', label: 'OL' },
    { id: 'auto_ol_c',  x: centerX,        y: yardLine - 1, team: 'o', label: 'OL' },
    { id: 'auto_ol_rg', x: centerX + 1.75, y: yardLine - 1, team: 'o', label: 'OL' },
    { id: 'auto_ol_rt', x: centerX + 3.5,  y: yardLine - 1, team: 'o', label: 'OL' },
    { id: 'auto_qb',    x: centerX,        y: yardLine - 6, team: 'o', label: 'QB' },
  ]
}

// ── Defense ───────────────────────────────────────────────────────────────────
//
// Four DL crowd the LOS (1 yard off the ball) in a spread front: the two ends line
// up outside the offensive tackles (±3) so they can rush the edge, while the two
// interior linemen sit over the guards.

function defenseAutoPlaced(yardLine: number, centerX: number = MID): PositionUpdate[] {
  return [
    { id: 'auto_dl1', x: centerX - 3.25, y: yardLine + 1, team: 'd', label: 'DL' },
    { id: 'auto_dl2', x: centerX - 1.25, y: yardLine + 1, team: 'd', label: 'DL' },
    { id: 'auto_dl3', x: centerX + 1.25, y: yardLine + 1, team: 'd', label: 'DL' },
    { id: 'auto_dl4', x: centerX + 3.25, y: yardLine + 1, team: 'd', label: 'DL' },
  ]
}

// Returns all auto-placed players for both teams.
// These are always on the field and cannot be moved by either player.
export function getAutoPlacedPlayers(yardLine: number, centerX: number = MID): PositionUpdate[] {
  return [...offenseAutoPlaced(yardLine, centerX), ...defenseAutoPlaced(yardLine, centerX)]
}

// ── Placement bounds ──────────────────────────────────────────────────────────
//
// Per-position Y constraints applied to both sidebar drops and canvas drags.
// Offense positions are relative to the LOS (yardLine).
// Defense limits are intentionally loose — there are no illegal formations on D.

export interface PositionBounds { minY: number; maxY: number }

export function getPositionYBounds(
  position: string,
  role: 'offense' | 'defense',
  yardLine: number,
): PositionBounds {
  // End zones are fair game: the offense may back into its own (down to −9.5) and the defense may
  // drop into the one it's defending (up to 109.5). Only the LOS and the back lines bound placement.
  const EZ_BACK_OWN = -9.5
  const EZ_BACK_OPP = 109.5
  if (role === 'offense') {
    switch (position) {
      case 'WR': return { minY: Math.max(EZ_BACK_OWN, yardLine - 7),  maxY: yardLine }
      case 'TE': return { minY: Math.max(EZ_BACK_OWN, yardLine - 5),  maxY: yardLine }
      case 'RB': return { minY: Math.max(EZ_BACK_OWN, yardLine - 10), maxY: yardLine - 2 }
      default:   return { minY: Math.max(EZ_BACK_OWN, yardLine - 15), maxY: yardLine }
    }
  } else {
    switch (position) {
      case 'LB': return { minY: yardLine, maxY: Math.min(EZ_BACK_OPP, yardLine + 10) }
      case 'CB': return { minY: yardLine, maxY: Math.min(EZ_BACK_OPP, yardLine + 20) }
      case 'S':  return { minY: yardLine, maxY: Math.min(EZ_BACK_OPP, yardLine + 25) }
      default:   return { minY: yardLine, maxY: Math.min(EZ_BACK_OPP, yardLine + 15) }
    }
  }
}

// ── Offensive formation enforcement ──────────────────────────────────────────
//
// NFL rules require:
//   • At least 7 players on the line of scrimmage (OL covers 5, need 2 more)
//   • No more than 4 players in the backfield (QB always backfield = 1, so 3 more max)
//
// This function receives only the user-placed players (not auto OL/QB) and returns
// adjusted copies with Y snapped so those two rules are always satisfied.
// X positions are never changed — the user controls horizontal alignment.

// Y where "on line" players sit — same row as the auto-placed OL
const LINE_Y_OFFSET   = 1    // yards behind LOS
// Players at or above this threshold snap to the line
const LINE_THRESHOLD  = 1.5  // yards behind LOS

export function enforceOffensiveFormation(
  players: PositionUpdate[],
  yardLine: number,
): PositionUpdate[] {
  const lineY         = yardLine - LINE_Y_OFFSET
  const lineThreshold = yardLine - LINE_THRESHOLD

  // Pass 1 — snap non-RB players within threshold up to the line row
  let result = players.map(p => {
    if (p.label === 'RB') return p
    return p.y >= lineThreshold ? { ...p, y: lineY } : p
  })

  // Pass 2 — enforce max 4 in backfield
  // Backfield count: QB(1, always) + RBs + non-RB players below threshold
  const backfieldNonRb = result.filter(p => p.label !== 'RB' && p.y < lineThreshold)
  const rbCount        = result.filter(p => p.label === 'RB').length
  const totalBackfield = 1 + backfieldNonRb.length + rbCount  // 1 = QB

  if (totalBackfield > 4) {
    const excess = totalBackfield - 4
    // Snap the non-RB backfield players closest to the LOS first
    const toSnap = new Set(
      [...backfieldNonRb]
        .sort((a, b) => b.y - a.y)
        .slice(0, excess)
        .map(p => p.id),
    )
    result = result.map(p => toSnap.has(p.id) ? { ...p, y: lineY } : p)
  }

  return result
}

// ── Formation validation ───────────────────────────────────────────────────────
//
// Returns a list of human-readable error strings.  An empty array means the
// formation is legal and the play can begin.  These are called from App.tsx
// on every render so the UI gives live feedback as players are placed.

export function validateOffensiveFormation(
  players: PositionUpdate[],
  totalRequired: number,
  yardLine: number,
): string[] {
  const missing = totalRequired - players.length
  if (missing > 0) {
    return [`Place ${missing} more player${missing === 1 ? '' : 's'} before the snap`]
  }

  // Safety-net checks (enforceOffensiveFormation should have already fixed these,
  // but we gate the snap on them in case something was skipped)
  const errors: string[] = []
  const lineThreshold = yardLine - LINE_THRESHOLD
  const onLine        = players.filter(p => p.y >= lineThreshold).length
  const backfield     = 1 + players.filter(p => p.y < lineThreshold).length  // 1 = QB

  if (5 + onLine < 7) {
    errors.push('Need at least 2 more players on the line of scrimmage')
  }
  if (backfield > 4) {
    errors.push('Too many players in the backfield — move one to the line')
  }

  return errors
}

export function validateDefensiveFormation(
  players: PositionUpdate[],
  totalRequired: number,
): string[] {
  const missing = totalRequired - players.length
  if (missing > 0) {
    return [`Place ${missing} more player${missing === 1 ? '' : 's'} before the snap`]
  }
  return []
}
