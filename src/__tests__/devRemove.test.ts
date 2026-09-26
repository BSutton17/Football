import { describe, it, expect } from 'vitest'
import { canRemoveAutoPlayer, isAutoPlayer, withoutRemoved } from '../game/devRemove'
import { getDLPlayers } from '../game/formation'

// [dev flags] Taking an auto-placed down lineman off the field in a dev build — for checking a
// three-man front, or clearing the ends out of the way to see the coverage behind them.

describe('which auto players a dev build may remove', () => {
  it('a down lineman, yes', () => {
    expect(canRemoveAutoPlayer('auto_dl1')).toBe(true)
    expect(canRemoveAutoPlayer('auto_dl4')).toBe(true)
  })

  it('⚠️ THE OFFENSE’S LINE AND QUARTERBACK, NEVER', () => {
    // They reach the server inside the locked set_offense payload, not as placements — so "removing"
    // one would desync the two sides rather than remove anybody, and a play with no passer is not a
    // scenario, it is a crash waiting to happen.
    for (const id of ['auto_ol_lt', 'auto_ol_c', 'auto_ol_rg', 'auto_qb']) {
      expect(canRemoveAutoPlayer(id)).toBe(false)
    }
  })

  it('nothing at all when there is no id', () => {
    expect(canRemoveAutoPlayer(null)).toBe(false)
    expect(canRemoveAutoPlayer(undefined)).toBe(false)
    expect(canRemoveAutoPlayer('')).toBe(false)
  })

  it('an ordinary placed player is not an auto player and needs no exception', () => {
    expect(isAutoPlayer('hou_cb1')).toBe(false)
    expect(isAutoPlayer('auto_dl1')).toBe(true)
    expect(isAutoPlayer('auto_qb')).toBe(true)
  })
})

describe('⚠️ A REMOVAL SURVIVES THE PLAY BOUNDARY', () => {
  // The DL row is regenerated from scratch at every new play, on a turnover and on reconnect. Without
  // this the lineman is back twenty-five seconds later, which is no use for looking at alignment
  // across a series of downs — the thing the feature exists for.
  const LOS = 40

  it('filters the regenerated row', () => {
    const row = getDLPlayers(LOS)
    expect(row).toHaveLength(4)
    const kept = withoutRemoved(row, new Set(['auto_dl1']))
    expect(kept).toHaveLength(3)
    expect(kept.some(p => p.id === 'auto_dl1')).toBe(false)
  })

  it('⚠️ REMEMBERS WHICH ONE, not just how many', () => {
    // The two ends and the two interior men stand in different places and do different jobs, so a
    // count would take the wrong lineman off on the very next play.
    const removed = new Set(['auto_dl1'])
    const kept = withoutRemoved(getDLPlayers(LOS), removed)
    const gone = getDLPlayers(LOS).find(p => p.id === 'auto_dl1')!
    expect(kept.every(p => p.x !== gone.x)).toBe(true)
  })

  it('more than one can come off', () => {
    const kept = withoutRemoved(getDLPlayers(LOS), new Set(['auto_dl3', 'auto_dl4']))
    expect(kept.map(p => p.id)).toEqual(['auto_dl1', 'auto_dl2'])
  })

  it('an empty set is the untouched row, and the same array', () => {
    const row = getDLPlayers(LOS)
    expect(withoutRemoved(row, new Set())).toBe(row)
  })

  it('an id that is not in the row changes nothing', () => {
    expect(withoutRemoved(getDLPlayers(LOS), new Set(['auto_dl99']))).toHaveLength(4)
  })

  it('all four can come off without throwing', () => {
    const all = new Set(getDLPlayers(LOS).map(p => p.id))
    expect(withoutRemoved(getDLPlayers(LOS), all)).toEqual([])
  })
})
