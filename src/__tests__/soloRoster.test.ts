import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NFL_TEAMS, teamById } from '../data/nflTeams.ts'

// ── The computer gets a real team, even when you do not pick one ─────────────
//
// ⚠️ "SURPRISE ME" USED TO COST THE COMPUTER ITS ENTIRE ROSTER, SILENTLY.
//
// `aiTeamId: null` means "pick for me", and createSoloRoom sent `aiRoster: []` alongside it. The server
// had nothing to field a team from, fell back to its synthetic roster — ids and positions, NO ratings and
// NO X-Factors — and the computer played a whole game on generic position baselines while the player used
// their real roster.
//
// And it was invisible: the synthetic ids are `sea_wr1`, `sea_cb1`, exactly like the real ones, so the
// opponent still showed as Seattle with Seattle's logo. It surfaced as a gameplay complaint — "the CBs
// were getting burned deep and the offense just could not do much" — rather than as a bug.
//
// For scale: Seattle's actual corner is 95 speed / 97 acceleration / 97 awareness with the Intimidator
// X-Factor, and the second is 97 speed with DEEP PASS DEMON, the very thing that was happening to the
// player. The computer ran at the CB baseline, 90 speed and 85 awareness, with no X-Factor at all.

const read = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8')

// The rosters the server needs to field a legal eleven, matching its own `normalizeRoster`.
const fieldable = (t: { offense?: unknown[]; defense?: unknown[] }) =>
  (t.offense?.length ?? 0) + (t.defense?.length ?? 0) >= 12

describe('every team can actually be fielded', () => {
  it('all 32 have enough players for the server to accept the roster', () => {
    const short = NFL_TEAMS.filter(t => !fieldable(t)).map(t => t.id)
    expect(short).toEqual([])
  })

  // ⚠️ THE POINT OF SENDING A ROSTER IS THE RATINGS. A full squad of unrated names passes the server's
  // count test and still fields eleven position baselines, which is the same handicap by another route.
  it('all 32 carry ratings on their skill and coverage players', () => {
    const unrated = NFL_TEAMS
      .filter(t => [...(t.offense ?? []), ...(t.defense ?? [])].every(p => !p.ratings))
      .map(t => t.id)
    expect(unrated).toEqual([])
  })

  it('Seattle in particular, since this is the game that found it', () => {
    const sea = teamById('SEA')!
    const cb1 = sea.defense.find(p => p.id === 'sea_cb1')!
    expect(cb1.ratings).toBeTruthy()
    expect(cb1.xFactor).toBeTruthy()
  })
})

// Checked at the SOURCE, the way zoomLock.test.ts is, because the regression here is editorial: the
// previous version read `const aiRoster = team ? soloRoster(team) : []`, which type-checks, builds, and
// passes every other test while quietly handing the computer nothing.
describe('createSoloRoom never sends an empty roster', () => {
  const src = read('src/socket/index.ts')
  // ⚠️ COMMENTS STRIPPED FIRST. The note above createSoloRoom quotes the broken line it replaced, so an
  // assertion against the raw text fails on the explanation of the bug rather than on the bug.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  const fn = code.slice(code.indexOf('export function createSoloRoom'), code.indexOf('export function randomSoloTeam'))

  it('resolves the random pick itself rather than leaving it to the server', () => {
    expect(fn).toContain('randomSoloTeam()')
  })

  it('sends a concrete team id, not the null it was given', () => {
    expect(fn).toContain('aiTeamId: team.id')
  })

  it('builds the roster unconditionally', () => {
    expect(fn).toContain('aiRoster: soloRoster(team)')
    expect(fn).not.toContain('aiRoster: []')
    expect(fn).not.toMatch(/team \? soloRoster\(team\) : \[\]/)
  })
})
