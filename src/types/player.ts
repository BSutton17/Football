export type OffensivePosition = 'QB' | 'WR' | 'TE' | 'RB' | 'OL'
export type DefensivePosition = 'DL' | 'LB' | 'CB' | 'S'
export type PlayerPosition = OffensivePosition | DefensivePosition

export type TeamRole = 'offense' | 'defense'

export interface PlayerRatings {
  speed?: number        // all except OL
  accel?: number        // legacy alias for acceleration
  acceleration?: number // burst — how quickly the player reaches top speed
  accuracy?: number     // QB
  routeRunning?: number // WR, TE, RB
  catching?: number     // WR, TE, RB
  blocking?: number     // TE, RB
  passBlock?: number    // OL — used on pass plays (pocket protection)
  runBlock?: number     // OL — used on run plays (drive blocking)
  vision?: number       // RB
  runPower?: number     // RB — chance to break tackles
  power?: number        // OL, DL
  strength?: number     // OL, DL, LB, CB, S
  passRush?: number     // DL, blitzing LB — ability to win the block fight / generate pressure
  coverage?: number     // CB, S, LB — pass-coverage skill
  press?: number        // CB, S — press jam at the LOS vs the receiver's route running
  awareness?: number    // LB, CB, S
  stamina?: number      // all — endurance; depletes with exertion, effect TBD
}

// Static player data — lives in team rosters, no position on field
export interface RosterPlayer {
  id: string
  name: string
  position: PlayerPosition
  ratings: PlayerRatings
  ovr?: number      // overall rating, 0–99 — cosmetic; shown on the player card, no gameplay effect
  xFactor?: string  // signature ability (e.g. 'Shifty', 'Ball Hawk') — shown on the card; effect TBD
}

// Runtime player — RosterPlayer placed on the field with coordinates
export interface Player extends RosterPlayer {
  x: number           // yards, 0–53.33 (sideline to sideline)
  y: number           // yards, 0–120 (offense end zone → defense end zone)
}
