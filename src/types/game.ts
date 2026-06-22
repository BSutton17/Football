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

export interface GameState {
  phase: PlayPhase
  quarter: Quarter
  clock: number       // seconds remaining in quarter
  down: Down
  distance: number    // yards needed for first down
  yardLine: number    // current yard line (0–100, offense perspective)
  score: Score
  role: TeamRole      // this viewer's current role — offense or defense
  fatigue?: Record<string, number>   // [fatigue] playerId → current stamina (0–100); drives the bars
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

export interface PlayResult {
  outcome: PlayOutcome
  yardsGained: number
  down: Down
  distance: number
  yardLine: number
  firstDown?: boolean       // [224][225] this play moved the chains
  newPossession?: TeamRole  // set on interception, safety, turnover on downs
  detail?: 'broken_up' | 'drop' | null   // [pass-outcome] why an incompletion fell — defended vs dropped
}

export type GameResult = 'win' | 'loss' | 'tie'

export interface GameOver {
  score: Score
  result: GameResult
}
