import { FIELD } from '../constants/simulation.ts'
import type { PositionUpdate } from '../types/game.ts'

export interface RoutePoint { x: number; y: number }

// Each entry is [outward, forward][] where waypoints are CUMULATIVE from player start.
// outward: +ve = toward nearest sideline, -ve = toward center
// forward: +ve = toward opponent end zone
type Waypoint = [number, number]

// These MUST stay in lock-step with the server's ROUTE_DEF (Server/src/game/utils/
// routeDefinitions.js) — the server simulates the receiver's path from this table, and
// any divergence makes the previewed/adjusted route not match where the WR actually runs.
export const ROUTE_WAYPOINTS: Record<string, Waypoint[]> = {
  // ── Short ──────────────────────────────────────────────────────────────────
  slant:      [[0, 3], [-6, 4]],
  zig:        [[0, 1], [-4, 3], [6, 3]],
  quick_out:  [[6, 4]],
  flat:       [[8, 3]],
  // ── Medium ─────────────────────────────────────────────────────────────────
  curl:       [[0, 7], [-1, 5]],
  out:        [[0, 10], [6, 10]],
  comeback:   [[0, 12], [4, 10]],
  dig:        [[0, 10], [-9, 10]],
  return:     [[0, 1], [6, 3], [-4, 3]],
  // ── Deep ───────────────────────────────────────────────────────────────────
  go:         [[0, 30]],
  post:       [[0, 10], [-9, 20]],
  corner:     [[0, 10], [8, 20]],
  seam:       [[-2, 22]],
  wheel:      [[6, 0], [6, 14]],
  deep_cross: [[0, 12], [-14, 18]],
  // ── TE-specific ────────────────────────────────────────────────────────────
  angle:      [[5, 5]],
  delay:      [[0, 8]],
  drag:       [[0, 3], [-8, 4]],
  cross:      [[0, 8], [-10, 8]],
  // ── RB-specific ────────────────────────────────────────────────────────────
  swing:      [[8, 1], [8, 4]],
  flare:      [[7, 4]],
  check_down: [[0, 3]],
  texas:      [[6, 5], [-2, 11]],
  screen:     [[5, -2]],
  // ── Assignment (no path drawn) ─────────────────────────────────────────────
  block:      [],
}

const MID = FIELD.WIDTH / 2

export function getRoutePath(
  route: string,
  player: PositionUpdate,
  depthScale = 1,
  pivotX: number = MID,
): RoutePoint[] {
  const waypoints = ROUTE_WAYPOINTS[route]
  if (!waypoints || waypoints.length === 0) return []

  // Mirror routes around the BALL'S spot (hash), not the field middle — the ball shifts laterally
  // through the game, so "outward" should face the sideline relative to where the ball is.
  const dir = player.x >= pivotX ? 1 : -1

  return waypoints.map(([outward, forward]) => ({
    x: Math.max(0.5, Math.min(FIELD.WIDTH - 0.5, player.x + outward * dir)),
    y: Math.max(0,   Math.min(110,               player.y + forward * depthScale)),
  }))
}

// Maximum forward yards in a route at depth scale 1 — used to normalize drag deltas
export function getRouteMaxForward(route: string): number {
  const waypoints = ROUTE_WAYPOINTS[route]
  if (!waypoints || waypoints.length === 0) return 1
  return Math.max(...waypoints.map(([, f]) => Math.abs(f)), 1)
}
