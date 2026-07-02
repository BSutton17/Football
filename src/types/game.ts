import type { TeamRole } from './player.ts'
import type { RouteType } from './routes.ts'

export type Down = 1 | 2 | 3 | 4
export type Quarter = 1 | 2 | 3 | 4

// pre_snap:  formation phase — both sides placing players
// countdown: offense locked in (set_offense called), defense still adjusting
// live:      ball in play
// dead:      play ended, result being processed
export type PlayPhase = 'pre_snap' | 'countdown' | 'live' | 'dead'

export interface Score {
  offense: number
  defense: number
}

// [Special Teams][1] Kinds of kick and the sub-phases of a kicking play. Mirror the server's
// game/specialTeams.js (KICK / ST_PHASE) — keep in sync.
export type KickType = 'kickoff' | 'punt' | 'field_goal' | 'extra_point'
export type SpecialTeamsPhase = 'setup' | 'kicking' | 'resolved'

// Viewer-relative special-teams snapshot from the server. Present only while a kick is in progress.
export interface SpecialTeamsState {
  kickType: KickType
  label: string              // display name, e.g. "Field Goal"
  phase: SpecialTeamsPhase
  kicking: boolean           // is THIS viewer the kicking team?
  returnable: boolean        // can the receiving team run it back?
  points: number             // points a make is worth (FG 3, XP 1, else 0)
  playerControlled: boolean  // [5] false for an automatic kickoff; true for punt/FG/XP
  power: number              // [9] 0 … 1; full at the start, drains over the kick timer
  angle: number              // [7] −1 (left) … +1 (right); 0 = centered aiming arrow
  started: boolean           // [8] has the kick timer begun (input given / inactivity elapsed)?
  secondsRemaining: number   // [8] kick-timer seconds left
  targetAngle: number        // [18] aim (−1..1) that splits the uprights from this hash (FG/XP); 0 otherwise
  fieldGoalDistance?: number | null   // [41] official FG/XP distance in yards (incl. end zone + holder); null otherwise
  blockAttempted?: boolean   // [46][49] defender has committed their FG/XP block attempt (bar locks)
  kickDistance?: number | null   // how far the punt travelled, shown to both players once kicked
  backspin: boolean          // [21] punt backspin toggle (only meaningful for punts)
  result: PuntPreview | Record<string, unknown> | null   // [27] in-flight info (punt = projected landing + hang)
  returnDecision?: PuntReturnDecision | null  // [28] in-field punt menu — set only for the receiving team
}

// [28][29] The receiving team's Return / Fair Catch / Let It Bounce menu. Present only when an
// in-field punt awaits a choice; every listed option is legal (illegal scenarios never arm it).
export type PuntReturnOption = 'return' | 'fair_catch' | 'let_it_bounce'

export interface PuntReturnDecision {
  secondsRemaining: number
  defaultOption: PuntReturnOption
  options: { id: PuntReturnOption; label: string; legal: boolean }[]
}

// [27] What the receiving team sees about a punt in the air — projected (air) landing + hang time.
// The final bounce/roll distance is deliberately NOT included.
export interface PuntPreview {
  kickType: 'punt'
  landingYardLine: number    // projected air landing, receiving frame (own goal 0 → opp goal 100)
  hangTime: number
  touchback: boolean
  outOfBounds: boolean
}

export interface GameState {
  phase: PlayPhase
  quarter: Quarter
  clock: number       // seconds remaining in quarter
  down: Down
  distance: number    // yards needed for first down
  yardLine: number    // current yard line (0–100, offense perspective)
  ballX?: number      // [hash] lateral spot the next formation lines up on (absolute X, yards)
  playClock?: number  // [play-clock] starting play-clock value for this snap (40 on a drive start, else 25)
  specialTeams?: SpecialTeamsState | null   // [Special Teams][1] non-null while a kick is in progress
  decision?: PlayDecision | null            // [Special Teams][2][3] 4th-down menu (offense only)
  xfActiveIds?: string[]                     // [294] players with an active X-Factor (star shows pre-snap too)
  score: Score
  role: TeamRole      // this viewer's current role — offense or defense
  fatigue?: Record<string, number>   // [fatigue] playerId → current stamina (0–100); drives the bars
  timeouts?: { own: number; opp: number }   // [70] remaining timeouts, viewer-relative (own = this team)
}

// Lightweight position payload sent every server tick during live play.
// y is offense-relative: 0 = own goal line, 100 = opponent goal line.
export type PlayerState =
  | 'normal'      // standard team color
  | 'selected'    // gold ring — currently selected/placing
  | 'ball'        // amber fill — has the ball
  | 'open'        // green — receiver with no defender near them
  | 'contested'   // yellow — receiver with a defender close but not locked on
  | 'covered'     // red — receiver completely smothered by a defender

export interface PositionUpdate {
  id: string
  x: number            // yards, sideline to sideline
  y: number            // yards, offense-relative
  team: 'o' | 'd'      // which side of the ball this player is on
  label?: string       // position abbreviation: QB, WR, CB … (shown on the field for OL/DL)
  name?: string        // player full name — the field shows their LAST name (except OL/DL)
  state?: PlayerState  // visual state; defaults to 'normal' if absent
  route?: RouteType        // assigned route — set during pre-snap, consumed at snap
  routeDepthScale?: number // depth multiplier (1 = default, 0.5 = half depth, 2 = double)
  openness?: number        // [169] pass-catcher openness 0–1 (0 = smothered, 1 = wide open)
  xfActive?: boolean       // [294] X-Factor currently active — drawn as a star instead of a circle
}

// [163] Run visualizer — the ball carrier's evaluated vision rays (offense-relative
// directions: forward = +y). dx/dy is a unit direction, clear is yards of open space.
export interface CarrierVisionRay { dx: number; dy: number; clear: number; selected: boolean }
export interface CarrierVision { id: string; rays: CarrierVisionRay[] }

// The outcome the server actually tags each play_result with. A first down is conveyed by the
// firstDown flag and a turnover on downs by newPossession on a tackle/sack/incomplete.
export type PlayOutcome =
  | 'tackle'
  | 'sack'
  | 'incomplete'
  | 'interception'
  | 'touchdown'
  | 'safety'
  | 'punt'
  | 'field_goal'   // [Special Teams] 4th-down FG attempt (detail 'made' | 'missed' | 'blocked' | miss reason)
  | 'extra_point'  // [Special Teams][51][52] extra-point kick (detail 'made' | 'missed')
  | 'two_point'    // [Special Teams][51] two-point conversion (detail 'made' | 'missed')

export interface PlayResult {
  outcome: PlayOutcome
  yardsGained: number
  down: Down
  distance: number
  yardLine: number
  firstDown?: boolean       // [224][225] this play moved the chains
  newPossession?: TeamRole  // set on interception, safety, turnover on downs
  detail?: 'broken_up' | 'drop' | 'made' | 'missed' | 'short' | 'wide_left' | 'wide_right' | 'blocked' | 'out_of_bounds' | 'touchback' | 'fair_catch' | 'return' | null   // incompletion reason, FG result, or punt result
}

// [Special Teams][2][3][4] The 4th-down menu, or [51] the post-TD extra-point / 2-pt menu — both
// render through the same component.
export type DecisionOption = 'go_for_it' | 'punt' | 'field_goal' | 'extra_point' | 'two_point'

export interface PlayDecision {
  context: 'fourth_down' | 'conversion'
  secondsRemaining: number          // server countdown before the default is auto-picked
  defaultOption: DecisionOption
  fieldGoalDistance?: number        // straight-line yards, for the FG button readout (4th-down only)
  options: { id: DecisionOption; label: string; legal: boolean }[]
}

export type GameResult = 'win' | 'loss' | 'tie'

export interface GameOver {
  score: Score
  result: GameResult
}
