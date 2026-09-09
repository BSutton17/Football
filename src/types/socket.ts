import type { TeamRole, PlayerRatings } from './player.ts'
import type { Quarter, Score, GameState, GameOver, PlayResult, PositionUpdate, CarrierVision, SpecialTeamsState, KickType, DecisionOption, GameMode, Difficulty } from './game.ts'
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
  // [route draw] A hand-drawn route, as offsets from this player's own spot ({ dx } across the
  // field, { dd } downfield). Present instead of a named `route` when the player drew one; the
  // server re-clamps it and builds the waypoints the receiver actually runs.
  drawnRoute?: { dx: number; dd: number }[]
  ratings?: PlayerRatings   // [293] per-team player attributes that drive the simulation
  xFactor?: string          // [294] signature ability the player can earn (inactive until earned)
}

export interface SetOffensePayload {
  // [stale set] The pre-snap situation this formation was designed against; the server refuses it
  // if the play has moved on (a delay-of-game penalty landing while the Set was in flight).
  playSerial?: number
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
  room_joined:          (data: { slot: number; mode?: GameMode; difficulty?: Difficulty }) => void
  room_full:            () => void
  room_not_found:       () => void
  room_error:           (data: { message: string }) => void
  // [manual] The code was valid but belongs to a room of the OTHER mode. The room is authoritative,
  // so the join is refused and the client is told which mode it would actually have been joining.
  room_mode_mismatch:   (data: { mode: GameMode }) => void
  roles_assigned:       (data: { role: TeamRole }) => void
  session_token:        (token: string) => void
  opponent_left:        () => void
  opponent_disconnected:() => void
  opponent_reconnected: () => void
  game_abandoned:       () => void
  reconnect_success:    (data: { roomId: string; role: TeamRole; slot?: number }) => void
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
  ball_snapped:       (data?: { manual?: boolean }) => void   // play is live; manual = GO drives it

  // [manual] The GO-button hold loop. manual_frozen / manual_resumed bracket every pause, and the
  // pass reveal runs manual_pass_pending ("It is…") → manual_pass_reveal ("Caught!" / "Dropped!" /
  // "Intercepted!" / "Broken up!") before the outcome is actually applied.
  manual_frozen:       () => void
  manual_resumed:      () => void
  manual_pass_pending: (data: { seconds: number }) => void
  manual_pass_reveal:  (data: { label: string }) => void
  qb_scrambling:      () => void   // [184] QB has committed to a scramble (throwing locked)
  play_clock_update:  (data: { playClock: number }) => void
  play_clock_expired: () => void

  // Timeouts ([69][70]) — a stoppage began (byYou = this viewer called it) with the updated counts,
  // or the stoppage elapsed and play resumes. Counts are viewer-relative (own = this player's team).
  timeout_started:    (data: { byYou: boolean; seconds: number; timeouts: { own: number; opp: number } }) => void
  timeout_ended:      () => void

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
  // [transition screens] A period ended — both players show a full-screen End-of-Quarter / Halftime
  // interstitial. kind distinguishes the two; endedQuarter is the quarter that just finished.
  period_transition: (data: { kind: 'quarter' | 'halftime'; endedQuarter: number; seconds: number }) => void
  game_over:        (data: GameOver) => void

  // Special teams ([Special Teams][1]) — viewer-relative kick state; null clears the kicking UI.
  special_teams_update: (data: SpecialTeamsState | null) => void
}

// ─── Client → Server ─────────────────────────────────────────────────────────

export interface ClientToServerEvents {
  // Room
  // [manual] The creator fixes the room's mode (and, for manual, its difficulty); a joiner sends the
  // mode it picked in the lobby so a mismatch can be refused rather than silently switched.
  create_room:        (payload: { roomId: string; mode: GameMode; difficulty: Difficulty }) => void
  join_room:          (payload: { roomId: string; mode: GameMode }) => void
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

  // Pre-snap — either team ([70]) — spend a timeout (stops the clock, brief frozen pause)
  call_timeout:       () => void

  // In-play — Offense
  snap_ball:          () => void
  // [manual] GO pressed / released. Press resumes the play (the first press is the snap itself);
  // release freezes it, subject to the anti-jitter minimum hold enforced server-side.
  go_press:           () => void
  go_release:         () => void
  throw_to_receiver:  (receiverId: string) => void
  throw_at_defender:  (defenderId: string) => void   // immediate interception by the clicked defender
  scramble:           () => void   // [184] convert the QB into a runner
  throwaway:          () => void   // [187] QB throws the ball away (incompletion)



  // Special teams ([Special Teams][12][14][21]) — directional aim ('left'/'right', each rotates +
  // refills 2% power) or the punt backspin toggle. The server owns everything else.
  special_teams_input: (data: { aim?: 'left' | 'right'; backspin?: boolean }) => void

  // 4th-down decision ([Special Teams][2][3]) — the offense picks Go For It / Punt / Field Goal.
  special_teams_choice: (data: { option: DecisionOption }) => void

  // Punt return decision ([Special Teams][28]) — the receiving team picks Return / Fair Catch / Let It Bounce.
  punt_return_choice: (data: { option: import('./game.ts').PuntReturnOption }) => void

  // Field goal block ([Special Teams][46][49]) — the defender commits a timing tap at bar position 0..1.
  fg_block: (data: { position: number }) => void

  // Postgame
  reset_game:         () => void   // [222] start a fresh game on the same room

  // Dev mode — stage a kick scenario (dev only). Not in the real game.
  dev_special_teams:  (data: { kickType: KickType; kickingSlot?: number }) => void
}
