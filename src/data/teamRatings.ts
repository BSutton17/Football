import type { NflTeam } from './nflTeams.ts'
import type { RosterPlayer } from '../types/player.ts'

// A team's overall ratings, as shown on the team-select and VS screens. NFL_TEAMS is the SOURCE OF
// TRUTH: we use each team's hand-set ovr / offOvr / defOvr, and only fall back to a roster-derived
// average for a field that's missing (so partially-filled teams still show something).
//   offense fallback = avg overall of QB + skill players + offensive line
//   defense fallback = avg overall of the defensive backfield + defensive line
//   overall fallback = the mean of the two units

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
  const offense = team.offOvr ?? avgOvr([team.qb, ...team.offense, ...(team.oline ?? [])])
  const defense = team.defOvr ?? avgOvr([...team.defense, ...(team.dline ?? [])])
  const overall = team.ovr   ?? Math.round((offense + defense) / 2)
  return { overall, offense, defense }
}
