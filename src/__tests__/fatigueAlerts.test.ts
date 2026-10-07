import { describe, it, expect } from 'vitest'
import { createFatigueAlerts, noteFatigue, alertedFatigue } from '../game/fatigueAlerts'

// [fatigue alerts] "When a player enters the yellow for the first time, show their and only their
// fatigue bar on the field for one snap. When they enter the red, show it until they are no longer
// in the red."
describe('fatigue bars without the Fatigue view', () => {
  it('first time in the yellow: just him, for one snap', () => {
    const a = createFatigueAlerts()
    const snap1 = { wr1: 58, wr2: 80, rb1: 75 }
    noteFatigue(a, snap1, 10)
    expect(alertedFatigue(a, snap1, 10)).toEqual({ wr1: 58 })        // only him
    // A refresh of the same play keeps it; the next line-up ends it.
    expect(alertedFatigue(a, snap1, 10)).toEqual({ wr1: 58 })
    const snap2 = { wr1: 55, wr2: 80, rb1: 75 }
    noteFatigue(a, snap2, 11)
    expect(alertedFatigue(a, snap2, 11)).toEqual({})
  })

  it('only the FIRST time — recovering to green and dipping again does not flash it twice', () => {
    const a = createFatigueAlerts()
    noteFatigue(a, { wr1: 59 }, 1)
    noteFatigue(a, { wr1: 70 }, 2)
    noteFatigue(a, { wr1: 57 }, 3)
    expect(alertedFatigue(a, { wr1: 57 }, 3)).toEqual({})
  })

  it('in the red: shown every snap, until he climbs out', () => {
    const a = createFatigueAlerts()
    for (const [s, v] of [[1, 28], [2, 25], [3, 29]] as const) {
      noteFatigue(a, { rb1: v }, s)
      expect(alertedFatigue(a, { rb1: v }, s)).toEqual({ rb1: v })
    }
    noteFatigue(a, { rb1: 34 }, 4)
    expect(alertedFatigue(a, { rb1: 34 }, 4)).toEqual({})
  })
})

describe('the bench', () => {
  it('a tired player off the field keeps his bar on the card until he is back in the green', async () => {
    const { benchStamina } = await import('../game/fatigueAlerts')
    expect(benchStamina({ wr1: 45, wr2: 61, rb1: 20 })).toEqual({ wr1: 45, rb1: 20 })
  })
})
