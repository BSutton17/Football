import { describe, it, expect } from 'vitest'
import { ONSIDE_GREEN_HALF, ONSIDE_YELLOW_HALF, ONSIDE_SWEEP_HALF_SECONDS, onsideTrackBackground } from '../game/onsideMeter.ts'
import { getSpecialTeamsFormation } from '../game/specialTeamsFormation.ts'
import { projectedLine } from '../season/format.ts'

describe('[onside] the meter on screen', () => {
  it('is 75% green, 20% yellow, 5% red', () => {
    expect(ONSIDE_GREEN_HALF * 2).toBeCloseTo(0.75)
    expect((ONSIDE_YELLOW_HALF - ONSIDE_GREEN_HALF) * 2).toBeCloseTo(0.20)
    expect(1 - ONSIDE_YELLOW_HALF * 2).toBeCloseTo(0.05)
  })

  it('draws those zones, in the order red, yellow, green, yellow, red', () => {
    const colors = onsideTrackBackground().match(/#[0-9a-f]{6}/g)
    expect(colors).toEqual(['#ef4444', '#facc15', '#22c55e', '#facc15', '#ef4444'])
    expect(onsideTrackBackground()).toContain('12.5%')
    expect(onsideTrackBackground()).toContain('87.5%')
  })

  it('sweeps five times as fast as the field-goal block bar', () => {
    expect(0.5 / ONSIDE_SWEEP_HALF_SECONDS).toBeCloseTo(5)
  })
})

describe('[onside] the formation', () => {
  const players = getSpecialTeamsFormation('onside_kick', 35, 26.665, { kicker: 'Name' })

  it('is eleven a side, the kicking team behind the ball and the hands team ten yards off', () => {
    const kicking = players.filter(p => p.team === 'o')
    const hands = players.filter(p => p.team === 'd')
    expect(kicking).toHaveLength(11)
    expect(hands).toHaveLength(11)
    for (const p of kicking) expect(p.y).toBeLessThan(35)
    for (const p of hands) expect(p.y).toBeGreaterThanOrEqual(45)
    expect(new Set(players.map(p => p.id)).size).toBe(22)
  })

  it('names the kicker', () => {
    expect(players.find(p => p.id === 'st_k')?.name).toBe('Name')
  })
})

describe('[projected] where the player stands', () => {
  const seeds = { AFC: ['KC', 'BUF', 'BAL', 'HOU', 'DEN', 'LAC', 'PIT'], NFC: ['DET', 'PHI', 'SF', 'TB', 'GB', 'MIN', 'WAS'] }

  it('names the seed, the bye, or being out', () => {
    expect(projectedLine(seeds, 'KC')).toBe("You hold the AFC's 1 seed and the first-round bye.")
    expect(projectedLine(seeds, 'GB')).toBe("You hold the NFC's 5 seed.")
    expect(projectedLine(seeds, 'CAR')).toBe('You are outside the field right now.')
  })
})
