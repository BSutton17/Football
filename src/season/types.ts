import type { Difficulty, GameMode } from '../types/game.ts'
import type { AuthUser } from './authStore.ts'

export interface SeasonSettings { mode: GameMode; difficulty: Difficulty; quarterMinutes: number }
export interface Record3 { w: number; l: number; t: number }

export interface SeasonGame {
  id: string
  week?: number
  round?: number
  conf?: 'AFC' | 'NFC' | null
  home: string
  away: string
  homeSeed?: number | null
  awaySeed?: number | null
  neutral?: boolean
  date?: string | null
  status: 'scheduled' | 'final'
  hs?: number
  as?: number
  ot?: boolean
  by?: 'sim' | 'user'
}

export interface StandingLine {
  id: string; w: number; l: number; t: number; pct: number; pf: number; pa: number; div: string; conf: string
}
export type Standings = Record<'AFC' | 'NFC', Record<'East' | 'North' | 'South' | 'West', StandingLine[]>>

export interface Playoffs {
  seeds: Record<'AFC' | 'NFC', string[]>
  round: number
  games: SeasonGame[]
  champion: string | null
  conferenceChampions: Partial<Record<'AFC' | 'NFC', string>>
}

export type SeasonScreen =
  | { type: 'made_playoffs'; seed: number; bye: boolean }
  | { type: 'missed_playoffs' }
  | { type: 'eliminated'; round: string; by: string }
  | { type: 'conference_champion'; conference: 'AFC' | 'NFC' }
  | { type: 'super_bowl_champion' }

export interface SeasonSummary {
  id: string
  slot: number
  year: number
  teamId: string
  settings: SeasonSettings
  phase: 'regular' | 'playoffs' | 'complete'
  week: number
  round: number | null
  record: Record3
  finish: 'missed' | 'eliminated' | 'champion' | null
  activeGameId: string | null
  updatedAt: string
  nextOpponent: string | null
  champion: string | null
}

export interface SeasonView extends SeasonSummary {
  games: SeasonGame[]
  playoffs: Playoffs | null
  screens: SeasonScreen[]
  currentGame: SeasonGame | null
  roundName: string | null
  standings: Standings
  superBowl: { number: number; numeral: string }
}

export interface Sos { rank: number; pct: number; w: number; l: number; t: number }

export interface Trophy {
  _id: string
  seasonId: string
  year: number
  numeral: string
  teamId: string
  record: Record3
  playoffRecord: { w: number; l: number }
  final: { home: string; away: string; hs: number; as: number; ot: boolean } | null
  createdAt: string
}

export interface SeasonHome {
  user: AuthUser
  slots: (SeasonSummary | null)[]
  trophies: Trophy[]
  schedule: {
    year: number
    numeral: string
    sosYear: number
    sos: Record<string, Sos>
    lastYear: Record<string, Record3>
    currentYear: number
  }
}
