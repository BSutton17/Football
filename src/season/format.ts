// Small, pure helpers for the season screens.

import { teamById } from '../data/nflTeams.ts'
import type { Record3, SeasonGame, SeasonSummary, SeasonView, Standings } from './types.ts'

export function recordText(r: Partial<Record3> | null | undefined): string {
  if (!r) return '0-0'
  return `${r.w ?? 0}-${r.l ?? 0}${r.t ? `-${r.t}` : ''}`
}

export const teamName = (id: string | null | undefined) => (id ? teamById(id)?.name ?? id : '')
export const teamAbbr = (id: string | null | undefined) => (id ? teamById(id)?.abbr ?? id : '')
// "Kansas City Chiefs" reads as "Chiefs" where there is not room for the whole thing.
export const teamNick = (id: string | null | undefined) => teamName(id).split(' ').slice(-1)[0] ?? ''

export function ordinal(n: number): string {
  const v = n % 100
  const suffix = v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}

export function isUserIn(game: SeasonGame, teamId: string): boolean {
  return game.home === teamId || game.away === teamId
}

export function opponentIn(game: SeasonGame, teamId: string): string {
  return game.home === teamId ? game.away : game.home
}

export type Outcome = 'W' | 'L' | 'T'

export function outcomeFor(game: SeasonGame, teamId: string): Outcome | null {
  if (game.status !== 'final') return null
  const us = game.home === teamId ? game.hs! : game.as!
  const them = game.home === teamId ? game.as! : game.hs!
  return us > them ? 'W' : us < them ? 'L' : 'T'
}

export function scoreFor(game: SeasonGame, teamId: string): string {
  const us = game.home === teamId ? game.hs : game.as
  const them = game.home === teamId ? game.as : game.hs
  return `${us}-${them}${game.ot ? ' OT' : ''}`
}

export function lineFor(standings: Standings, teamId: string) {
  for (const conf of Object.values(standings)) {
    for (const division of Object.values(conf)) {
      const i = division.findIndex(l => l.id === teamId)
      if (i >= 0) return { ...division[i], place: i + 1 }
    }
  }
  return null
}

// Weeks 1 to 18 for one team, with the bye filled in where there is no game.
export function scheduleRows(view: SeasonView): { week: number; game: SeasonGame | null }[] {
  const rows: { week: number; game: SeasonGame | null }[] = []
  for (let week = 1; week <= 18; week++) {
    rows.push({ week, game: view.games.find(g => g.week === week && isUserIn(g, view.teamId)) ?? null })
  }
  return rows
}

export function lastPlayed(view: SeasonView): SeasonGame | null {
  const games = [...view.games, ...(view.playoffs?.games ?? [])]
    .filter(g => isUserIn(g, view.teamId) && g.status === 'final')
  return games.at(-1) ?? null
}

// The one line that says where a save has got to.
export function statusLine(s: SeasonSummary): string {
  if (s.finish === 'champion') return 'Super Bowl champions'
  if (s.phase === 'complete') return s.finish === 'missed' ? 'Missed the playoffs' : 'Eliminated in the playoffs'
  if (s.activeGameId) return 'Game in progress'
  if (s.phase === 'playoffs') {
    return ['', 'Wild Card', 'Divisional round', 'Conference title', 'Super Bowl'][s.round ?? 1] ?? 'Playoffs'
  }
  return `Week ${s.week}`
}

export function modeLine(s: { settings: { mode: string; difficulty: string; quarterMinutes: number } }): string {
  const cap = (t: string) => t[0].toUpperCase() + t.slice(1)
  return `${cap(s.settings.mode)} · ${cap(s.settings.difficulty)} · ${s.settings.quarterMinutes} min`
}

// Super Bowl art by season. A year without its own art gets the league's logo.
const SUPER_BOWL_ART: Record<number, string> = { 2026: '/season/super-bowl-2026.svg' }
export const NFL_LOGO = '/season/nfl.png'

export function superBowlArt(year: number | null | undefined): string {
  return (year != null && SUPER_BOWL_ART[year]) || NFL_LOGO
}
