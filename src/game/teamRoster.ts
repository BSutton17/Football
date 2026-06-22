import type { RosterPlayer, PlayerRatings } from '../types/player.ts'
import { NFL_TEAMS } from '../data/nflTeams.ts'
import { OFFENSE_ROSTER, DEFENSE_ROSTER } from '../data/mockRoster.ts'

// The fixed ids the formation system assigns to auto-placed players (see game/formation.ts).
// Team oline/dline ratings are mapped onto these in roster order so blocking / pass-rush ratings
// reach the simulation for the line too.
const AUTO_OL_IDS = ['auto_ol_lt', 'auto_ol_lg', 'auto_ol_c', 'auto_ol_rg', 'auto_ol_rt']
const AUTO_DL_IDS = ['auto_dl1', 'auto_dl2', 'auto_dl3', 'auto_dl4']
const AUTO_QB_ID  = 'auto_qb'

// [289][290][291][292] Selected-team roster loader + player entity factory.
//
// Turns the chosen team's static roster data into the in-memory player entities the game drags onto
// the field. The offense pool is the team's skill players (4 WR / 3 TE / 2 RB) and the defense pool
// is its coverage players (4 CB / 3 S / 4 LB) — the same shape the sidebar/formation code expects.
// (QB, OL and DL are auto-placed by the formation system, not dragged from the sidebar.)

export interface TeamRoster {
  teamId:  string | null
  offense: RosterPlayer[]   // [291] offensive starters available to field
  defense: RosterPlayer[]   // [292] defensive starters available to field
  // [293] playerId → ratings for every entity the game places, including the auto-placed
  // OL/QB/DL — so the client can send each player's ratings to the server.
  ratingsById: Record<string, PlayerRatings>
  // [294] playerId → the player's potential X-Factor ability (if any).
  xFactorById: Record<string, string>
  // playerId → full name, including the auto-placed QB so the field can label it by last name.
  nameById: Record<string, string>
}

// [290] Player entity factory — produce a fresh game entity from a roster player. The shapes
// already match (id, name, position, ovr, xFactor, ratings); cloning keeps placement from mutating
// the source team data and guarantees every entity carries its own attributes + position.
export function makePlayerEntity(p: RosterPlayer): RosterPlayer {
  return {
    id:       p.id,
    name:     p.name,
    position: p.position,
    ovr:      p.ovr,
    xFactor:  p.xFactor,
    ratings:  { ...p.ratings },
  }
}

// [289] Load a team's roster into memory. Falls back to the generic mock roster when the team is
// unknown (e.g. a mid-game reconnect before the pick is restored), so the game always has a roster.
export function loadTeamRoster(teamId: string | null | undefined): TeamRoster {
  const team = teamId ? NFL_TEAMS.find(t => t.id === teamId) : null
  if (!team) {
    const offense = OFFENSE_ROSTER.map(makePlayerEntity)
    const defense = DEFENSE_ROSTER.map(makePlayerEntity)
    const ratingsById: Record<string, PlayerRatings> = {}
    const nameById: Record<string, string> = {}
    for (const p of [...offense, ...defense]) { ratingsById[p.id] = p.ratings; nameById[p.id] = p.name }
    return { teamId: null, offense, defense, ratingsById, xFactorById: {}, nameById }
  }

  const offense = team.offense.map(makePlayerEntity)   // [291] WR / TE / RB
  const defense = team.defense.map(makePlayerEntity)   // [292] CB / S / LB

  // [293][294] Map every placeable id → ratings / X-Factor / name, including the auto-placed
  // OL/QB/DL (by roster order), so the client can send them to the server and label the QB.
  const ratingsById: Record<string, PlayerRatings> = {}
  const xFactorById: Record<string, string> = {}
  const nameById: Record<string, string> = {}
  const register = (id: string, p: RosterPlayer) => {
    ratingsById[id] = p.ratings
    nameById[id] = p.name
    if (p.xFactor) xFactorById[id] = p.xFactor
  }
  for (const p of [...offense, ...defense]) register(p.id, p)
  if (team.qb) register(AUTO_QB_ID, team.qb)
  ;(team.oline ?? []).forEach((p, i) => { if (AUTO_OL_IDS[i]) register(AUTO_OL_IDS[i], p) })
  ;(team.dline ?? []).forEach((p, i) => { if (AUTO_DL_IDS[i]) register(AUTO_DL_IDS[i], p) })

  return { teamId: team.id, offense, defense, ratingsById, xFactorById, nameById }
}
