import type { TeamRole, PlayerRatings } from './player.ts'
import type { Quarter, Score, GameState, GameOver, PlayResult, PositionUpdate, CarrierVision } from './game.ts'
import type { RouteType, CoverageType, ZoneType } from './routes.ts'

// ─── Shared payload shapes ────────────────────────────────────────────────────

export interface PlacePlayerPayload {
  id: string
  x: number           // yards
  y: number           // yards
  label: string
  team: 'o' | 'd'
  ratings?: PlayerRatings   // [293] per-team player attributes that drive the simulation
  xFactor?: string          // [294] signature ability the player can earn (inactive until earned)
}

export interface PlayerDesign {
  id: string
  x: number
  y: number
  label: string
  team: 'o' | 'd'
  route?: RouteType
  routeDepthScale?: number
  ratings?: PlayerRatings   // [293] per-team player attributes that drive the simulation
  xFactor?: string          // [294] signature ability the player can earn (inactive until earned)
}

export interface SetOffensePayload {
  playType: 'run' | 'pass'
  runAngle: number      // degrees, -60 to +60
  players: PlayerDesign[]
}

export interface AssignRoutePayload {
  playerId: string
  route: RouteType
  stemDepth?: number  // yards before the route break
}

export interface AssignCoveragePayload {
  playerId: string
  type: CoverageType
  targetId?: string    // man coverage: the receiver being covered
  zoneType?: ZoneType  // zone coverage: which zone shape
  zoneCenterX?: number // zone coverage: where the zone center is placed
  zoneCenterY?: number
}

export interface AssignSafetyHelpPayload {
  safetyId: string
  targetDefenderId: string | null  // null clears the assignment
}

// ─── Server → Client ─────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  // Room
  room_joined:          (data: { slot: number }) => void
  room_full:            () => void
  room_not_found:       () => void
  room_error:           (data: { message: string }) => void
  roles_assigned:       (data: { role: TeamRole }) => void
  session_token:        (token: string) => void
  opponent_left:        () => void
  opponent_disconnected:() => void
  opponent_reconnected: () => void
  game_abandoned:       () => void
  reconnect_success:    (data: { roomId: string; role: TeamRole }) => void
  reconnect_failed:     () => void
  game_state:           (state: GameState) => void  // full snapshot on start or reconnect

  // Team selection ([268][269]) — both clients enter selection at once; server is authoritative.
  team_select_start:    (data: { slot: number; teamIds: string[] }) => void
  team_selected:        (data: { slot: number; teamId: string; locked: boolean }) => void  // a pick/lock
  team_taken:           (data: { teamId: string }) => void   // [282] lock rejected — opponent has it
  team_select_complete: (data: { teams: (string | null)[] }) => void   // both locked → game begins

  // Pre-snap sync (server echoes placements to both clients)
  player_placed:    (data: PlacePlayerPayload) => void
  player_removed:   (playerId: string) => void
  route_assigned:   (data: AssignRoutePayload) => void
  coverage_assigned:  (data: AssignCoveragePayload) => void
  coverage_cleared:   (data: { playerId: string }) => void
  offense_set:        (data: { playClockRemaining: number }) => void
  hike_countdown:     (data: { count: number }) => void   // 5→0 after offense sets; 0 = hike enabled
  ball_snapped:       () => void   // play is live
  qb_scrambling:      () => void   // [184] QB has committed to a scramble (throwing locked)
  play_clock_update:  (data: { playClock: number }) => void
  play_clock_expired: () => void

  // Live play
  positions_update: (positions: PositionUpdate[]) => void
  carrier_vision:   (vision: CarrierVision | null) => void   // [163] run visualizer debug rays
  pass_thrown:      (data: { receiverId: string }) => void   // [pass-line] both teams draw the pass line
  tackle_broken:    (data: { carrierId: string }) => void    // [run power] carrier shrugged off a tackle

  // Post-play
  play_result:      (result: PlayResult) => void
  touchdown:        (data: { scored: boolean; score: Score }) => void   // [196] celebration hook (audio/anim later)
  clock_update:     (data: { quarter: Quarter; clock: number }) => void
  score_update:     (score: Score) => void
  switch_sides:     (data: { role: TeamRole }) => void   // [192] possession changed — each side's new role
  halftime:         () => void   // [218] Q2 → Q3 break (foundation for halftime UI)
  game_over:        (data: GameOver) => void
}

// ─── Client → Server ─────────────────────────────────────────────────────────

export interface ClientToServerEvents {
  // Room
  create_room:        (roomId: string) => void
  join_room:          (roomId: string) => void
  reconnect_to_room:  (token: string) => void

  // Team selection ([269]) — provisional pick (browsing) and final lock.
  select_team:        (data: { teamId: string }) => void
  lock_team:          (data: { teamId: string }) => void

  // Pre-snap — Offense and Defense
  place_player:       (data: PlacePlayerPayload) => void
  remove_player:      (id: string) => void
  assign_route:       (data: AssignRoutePayload) => void
  set_offense:        (data: SetOffensePayload) => void

  // Pre-snap — Defense
  assign_coverage:  (data: AssignCoveragePayload) => void
  clear_coverage:   (data: { playerId: string }) => void

  // Pre-snap — Offense
  punt:               () => void   // [punt] 4th-down punt

  // In-play — Offense
  snap_ball:          () => void
  throw_to_receiver:  (receiverId: string) => void
  throw_at_defender:  (defenderId: string) => void   // immediate interception by the clicked defender
  scramble:           () => void   // [184] convert the QB into a runner
  throwaway:          () => void   // [187] QB throws the ball away (incompletion)



  // Postgame
  reset_game:         () => void   // [222] start a fresh game on the same room

  // Dev mode — one-click playtest setup (offense-relative coords). Not in the real game.
  dev_quick_setup:    (data: DevSetupPayload) => void
}

export interface DevSetupPayload {
  offense:  { id: string; x: number; y: number; label: string; route?: string }[]
  defense:  { id: string; x: number; y: number; label: string }[]
  coverage: {
    playerId: string; type: string; targetId?: string
    zoneType?: string; zoneCenterX?: number; zoneCenterY?: number
  }[]
}
