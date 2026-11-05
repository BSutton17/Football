import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isUserIn, modeLine, NFL_LOGO, opponentIn, ordinal, outcomeFor, recordText, scheduleRows, scoreFor,
  statusLine, superBowlArt,
} from '../season/format.ts'
import type { SeasonGame, SeasonSummary, SeasonView } from '../season/types.ts'

const read = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8')

const game = (over: Partial<SeasonGame>): SeasonGame => ({
  id: 'g', home: 'KC', away: 'DEN', status: 'final', hs: 27, as: 20, ...over,
})

const summary = (over: Partial<SeasonSummary>): SeasonSummary => ({
  id: 's', slot: 0, year: 2026, teamId: 'KC',
  settings: { mode: 'manual', difficulty: 'hard', quarterMinutes: 4 },
  phase: 'regular', week: 7, round: null, record: { w: 4, l: 2, t: 0 }, finish: null, activeGameId: null,
  updatedAt: '', nextOpponent: null, champion: null, ...over,
})

describe('[seasons] what the screens say', () => {
  it('a record leaves the ties out unless there are some', () => {
    expect(recordText({ w: 10, l: 7, t: 0 })).toBe('10-7')
    expect(recordText({ w: 10, l: 6, t: 1 })).toBe('10-6-1')
    expect(recordText(null)).toBe('0-0')
  })

  it('ordinals, including the awkward ones', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'])
  })

  it('a result reads from the player\'s side, home or away', () => {
    expect(outcomeFor(game({}), 'KC')).toBe('W')
    expect(outcomeFor(game({}), 'DEN')).toBe('L')
    expect(outcomeFor(game({ hs: 20, as: 20 }), 'KC')).toBe('T')
    expect(outcomeFor(game({ status: 'scheduled' }), 'KC')).toBeNull()
    expect(scoreFor(game({}), 'DEN')).toBe('20-27')
    expect(scoreFor(game({ ot: true }), 'KC')).toBe('27-20 OT')
    expect(opponentIn(game({}), 'DEN')).toBe('KC')
    expect(isUserIn(game({}), 'BUF')).toBe(false)
  })

  it('a save says where it has got to', () => {
    expect(statusLine(summary({}))).toBe('Week 7')
    expect(statusLine(summary({ activeGameId: 'x' }))).toBe('Game in progress')
    expect(statusLine(summary({ phase: 'playoffs', round: 2 }))).toBe('Divisional round')
    expect(statusLine(summary({ phase: 'complete', finish: 'champion' }))).toBe('Super Bowl champions')
    expect(statusLine(summary({ phase: 'complete', finish: 'missed' }))).toBe('Missed the playoffs')
    expect(statusLine(summary({ phase: 'complete', finish: 'eliminated' }))).toBe('Eliminated in the playoffs')
    expect(modeLine(summary({}))).toBe('Manual · Hard · 4 min')
  })

  it('the schedule has eighteen weeks, with the bye filled in', () => {
    const games = Array.from({ length: 18 }, (_, i) => i + 1)
      .filter(w => w !== 6)
      .map(week => game({ id: `w${week}`, week, status: 'scheduled' }))
    const rows = scheduleRows({ games, teamId: 'KC' } as unknown as SeasonView)
    expect(rows).toHaveLength(18)
    expect(rows[5]).toEqual({ week: 6, game: null })
    expect(rows[6].game?.id).toBe('w7')
  })

  it('⚠️ A YEAR WITHOUT ITS OWN SUPER BOWL ART GETS THE LEAGUE\'S LOGO', () => {
    expect(superBowlArt(2026)).toBe('/season/super-bowl-2026.svg')
    expect(superBowlArt(2031)).toBe(NFL_LOGO)
    expect(superBowlArt(null)).toBe(NFL_LOGO)
  })
})

// Checked at the source, the way zoomLock.test.ts is: these are all one careless edit from coming back,
// fail no type-check, and only show on a real phone.
describe('[quick leave] the things a phone needs', () => {
  it('⚠️ THE SOCKET NEVER GIVES UP', () => {
    expect(read('src/socket/index.ts')).toMatch(/reconnectionAttempts:\s*Infinity/)
  })

  it('⚠️ A FAILED CONNECTION DOES NOT THROW THE GAME AWAY', () => {
    const src = read('src/hooks/useRoom.ts')
    const handler = src.slice(src.indexOf('function onConnectError'), src.indexOf('function onConnected'))
    expect(handler).not.toMatch(/removeItem\(SESSION_KEY\)/)
  })

  it('⚠️ A GAME IS REMEMBERED THROUGH gameStore, which survives a home-screen relaunch', () => {
    for (const file of ['src/App.tsx', 'src/hooks/useRoom.ts', 'src/socket/index.ts']) {
      const code = read(file).split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
      expect(code).not.toMatch(/\bsessionStorage\./)
    }
    expect(read('src/utils/gameStore.ts')).toMatch(/isStandalone\(\) \? window\.localStorage : window\.sessionStorage/)
  })

  it('⚠️ THE LOGIN IS NOT SESSION STORAGE, and only a real 401 clears it', () => {
    expect(read('src/season/authStore.ts')).toMatch(/localStorage\.setItem\(KEY/)
    const app = read('src/season/SeasonApp.tsx')
    expect(app).toMatch(/err instanceof SignedOut\) \{ signOutLocally\(\)/)
    // A server that cannot be reached is not one that said no.
    expect(read('src/season/api.ts')).toMatch(/res\.status === 503\) throw new Unreachable/)
  })

  it('⚠️ WHOSE PLAYER IT IS COMES FROM THE ROLE AS OF THE MESSAGE, not the last render', () => {
    const src = read('src/App.tsx')
    const handler = src.slice(src.indexOf('function onPlayerPlaced'), src.indexOf('function onPlayerRemoved'))
      .split(/\r?\n/).filter(l => !l.trim().startsWith('//')).join(' ')
    expect(handler).toMatch(/room\.roleRef\.current/)
    expect(handler).not.toMatch(/room\.role\b(?!Ref)/)
  })

  it('the app says it is leaving, and reconnects on the way back', () => {
    const src = read('src/socket/lifecycle.ts')
    expect(src).toMatch(/socket\.emit\('app_hidden'\)/)
    expect(src).toMatch(/socket\.emit\('app_visible'\)/)
    expect(src).toMatch(/visibilitychange/)
    expect(src).toMatch(/pagehide/)
  })
})

describe('[auth] the sign-in page', () => {
  const html = read('public/login.html')

  it('⚠️ NEVER TAKES THE SERVER ADDRESS FROM THE LINK: the credential would go wherever it said', () => {
    const script = html.slice(html.indexOf('<script>'))
    expect(script).not.toMatch(/params\.get\(['"](s|server|url|api)['"]\)/)
    expect(script).toMatch(/const SERVER = isLocal \?/)
  })

  it('is for this app', () => {
    expect(html).toContain('133838464157-itoa8ptipuc4pbnkmu9tm2otnuubdm23.apps.googleusercontent.com')
  })
})
