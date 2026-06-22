import type { NflTeam } from './nflTeams.ts'
import type { RosterPlayer } from '../types/player.ts'

// [276] Derive a team's overall rating from its roster strength rather than a hand-set number.
//   offense = avg overall of QB + skill players + offensive line
//   defense = avg overall of the defensive front seven/backfield + defensive line
//   overall = the mean of the two units
// Falls back to the player's stored ovr; players without an ovr are ignored in the average.

export interface TeamRatings {
  overall: number
  offense: number
  defense: number
}

function avgOvr(players: (RosterPlayer | undefined)[]): number {
  const vals = players
    .filter((p): p is RosterPlayer => !!p)
    .map(p => p.ovr ?? 0)
    .filter(n => n > 0)
  if (vals.length === 0) return 0
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

export function computeTeamRatings(team: NflTeam): TeamRatings {
  const offense = avgOvr([team.qb, ...team.offense, ...(team.oline ?? [])])
  const defense = avgOvr([...team.defense, ...(team.dline ?? [])])
  const overall = Math.round((offense + defense) / 2)
  return { overall, offense, defense }
}
