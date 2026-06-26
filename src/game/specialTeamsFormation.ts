import type { PositionUpdate } from '../types/game.ts'
import type { KickType } from '../types/game.ts'
import { FIELD } from '../constants/simulation.ts'

// [Special Teams formations] PURELY VISUAL. When a punt / field goal / extra point begins, both
// teams line up in a realistic NFL special-teams formation so the play reads at a glance. These
// positions never touch the server, ratings, collisions, blocking, or the kick math — the client
// just draws them. Everything is built relative to the ball: x is centered on the spotted hash
// (ballX) and shifts with it; y is offense-relative (offense faces up, toward the opponent's end
// zone), with the kicker/punter BEHIND the line of scrimmage and the return men downfield.

const HALF = 1.5                       // keep a player's body in bounds
const MINX = HALF
const MAXX = FIELD.WIDTH - HALF
const clampX = (x: number) => Math.max(MINX, Math.min(MAXX, x))

interface Spec { id: string; team: 'o' | 'd'; label: string; dx: number; dy: number }

function build(specs: Spec[], losYardLine: number, ballX: number): PositionUpdate[] {
  return specs.map(s => ({
    id:    `st_${s.id}`,
    x:     clampX(ballX + s.dx),
    y:     losYardLine + s.dy,        // +dy is downfield (toward the opponent), −dy is behind the LOS
    team:  s.team,
    label: s.label,
  }))
}

// ── Punt ─────────────────────────────────────────────────────────────────────
const PUNT: Spec[] = [
  // Offensive line — shoulder to shoulder on the LOS
  { id: 'lt', team: 'o', label: 'OL', dx: -3.2, dy: 0 },
  { id: 'lg', team: 'o', label: 'OL', dx: -1.6, dy: 0 },
  { id: 'c',  team: 'o', label: 'OL', dx:  0,   dy: 0 },
  { id: 'rg', team: 'o', label: 'OL', dx:  1.6, dy: 0 },
  { id: 'rt', team: 'o', label: 'OL', dx:  3.2, dy: 0 },
  // Personal protectors — ~2.5 yds behind the guards
  { id: 'ppl', team: 'o', label: 'PP', dx: -1.6, dy: -2.5 },
  { id: 'ppr', team: 'o', label: 'PP', dx:  1.6, dy: -2.5 },
  // Punter — ~14 yds behind the center
  { id: 'p',  team: 'o', label: 'P', dx: 0, dy: -14 },
  // Gunners — split near the sidelines, slightly off the LOS
  { id: 'gl', team: 'o', label: 'G', dx: -24, dy: -1 },
  { id: 'gr', team: 'o', label: 'G', dx:  24, dy: -1 },

  // Return-team front: four DL across, two edge contain, three LBs
  { id: 'dl1', team: 'd', label: 'DL', dx: -2.4, dy: 1 },
  { id: 'dl2', team: 'd', label: 'DL', dx: -0.8, dy: 1 },
  { id: 'dl3', team: 'd', label: 'DL', dx:  0.8, dy: 1 },
  { id: 'dl4', team: 'd', label: 'DL', dx:  2.4, dy: 1 },
  { id: 'el',  team: 'd', label: 'E',  dx: -5.5, dy: 1 },
  { id: 'er',  team: 'd', label: 'E',  dx:  5.5, dy: 1 },
  { id: 'lb1', team: 'd', label: 'LB', dx: -3, dy: 4 },
  { id: 'lb2', team: 'd', label: 'LB', dx:  0, dy: 4 },
  { id: 'lb3', team: 'd', label: 'LB', dx:  3, dy: 4 },
  // Two return men deep (one under the ball, one safety outlet)
  { id: 'pr1', team: 'd', label: 'PR', dx:  0, dy: 40 },
  { id: 'pr2', team: 'd', label: 'PR', dx:  6, dy: 45 },
]

// ── Field goal / extra point ──────────────────────────────────────────────────
const FIELD_GOAL: Spec[] = [
  // Tight, plus a TE just outside each tackle
  { id: 'lt', team: 'o', label: 'OL', dx: -2.8, dy: 0 },
  { id: 'lg', team: 'o', label: 'OL', dx: -1.4, dy: 0 },
  { id: 'c',  team: 'o', label: 'OL', dx:  0,   dy: 0 },
  { id: 'rg', team: 'o', label: 'OL', dx:  1.4, dy: 0 },
  { id: 'rt', team: 'o', label: 'OL', dx:  2.8, dy: 0 },
  { id: 'tel', team: 'o', label: 'TE', dx: -4.4, dy: 0 },
  { id: 'ter', team: 'o', label: 'TE', dx:  4.4, dy: 0 },
  // Holder ~7 yds back, kicker ~7 yds behind the holder
  { id: 'h', team: 'o', label: 'H', dx: 0, dy: -7 },
  { id: 'k', team: 'o', label: 'K', dx: 0, dy: -14 },

  // FG block: four DL, two edges outside the TEs, three LBs, two DBs deep (vs the fake)
  { id: 'dl1', team: 'd', label: 'DL', dx: -2.4, dy: 1 },
  { id: 'dl2', team: 'd', label: 'DL', dx: -0.8, dy: 1 },
  { id: 'dl3', team: 'd', label: 'DL', dx:  0.8, dy: 1 },
  { id: 'dl4', team: 'd', label: 'DL', dx:  2.4, dy: 1 },
  { id: 'el',  team: 'd', label: 'E',  dx: -6, dy: 1 },
  { id: 'er',  team: 'd', label: 'E',  dx:  6, dy: 1 },
  { id: 'lb1', team: 'd', label: 'LB', dx: -3, dy: 3 },
  { id: 'lb2', team: 'd', label: 'LB', dx:  0, dy: 3 },
  { id: 'lb3', team: 'd', label: 'LB', dx:  3, dy: 3 },
  { id: 'db1', team: 'd', label: 'DB', dx: -4, dy: 7 },
  { id: 'db2', team: 'd', label: 'DB', dx:  4, dy: 7 },
]

// The formation for a kick, centered on the ball's hash and the LOS. Extra points reuse the field-
// goal alignment (the ball is spotted centered at the opponent's 25, handled by the server).
// `kicker` / `punter` names (the kicking team's real specialists) are shown on the K / P markers.
export function getSpecialTeamsFormation(
  kickType: KickType, losYardLine: number, ballX: number,
  names: { kicker?: string; punter?: string } = {},
): PositionUpdate[] {
  const specs   = kickType === 'punt' ? PUNT : FIELD_GOAL
  const players = build(specs, losYardLine, ballX)
  // Show the real specialist's name on the kicker (FG/XP) or punter (punt).
  for (const p of players) {
    if (p.id === 'st_k' && names.kicker) p.name = names.kicker
    if (p.id === 'st_p' && names.punter) p.name = names.punter
  }
  return players
}
