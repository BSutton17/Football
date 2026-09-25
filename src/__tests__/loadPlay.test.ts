import { describe, it, expect } from 'vitest'
import { fillSlots } from '../game/loadPlay'
import type { RosterPlayer } from '../types/player'

// [authored] Filling a recommended play's slots from this team's bench — which is where personnel
// substitution actually happens, because the server has no roster to do it with.

const p = (id: string, position: string, ovr: number): RosterPlayer =>
  ({ id, name: id, position, ovr, ratings: {} } as RosterPlayer)

const BENCH: RosterPlayer[] = [
  p('wr3', 'WR', 76), p('wr1', 'WR', 88), p('wr2', 'WR', 82), p('wr4', 'WR', 72),
  p('te2', 'TE', 75), p('te1', 'TE', 79),
  p('rb1', 'RB', 85), p('rb2', 'RB', 70),
]

const spot = (label: string, x = 10, y = 30) => ({ label, x, y })

describe('filling an authored play from the bench', () => {
  it('takes the best available at each position', () => {
    const { filled } = fillSlots([spot('WR'), spot('WR'), spot('TE')], BENCH)
    expect(filled.map(f => f.player.id)).toEqual(['wr1', 'wr2', 'te1'])
  })

  it('never puts the same player in two slots', () => {
    const { filled, usedIds } = fillSlots([spot('WR'), spot('WR'), spot('WR'), spot('WR')], BENCH)
    expect(usedIds.size).toBe(4)
    expect(new Set(filled.map(f => f.player.id)).size).toBe(4)
  })

  it('⚠️ SUBSTITUTES — an empty set and a heavy formation field different people', () => {
    // This is the whole reason the client fills the slots: picking a play is also picking personnel.
    const empty = fillSlots([spot('WR'), spot('WR'), spot('WR'), spot('WR'), spot('RB')], BENCH)
    const heavy = fillSlots([spot('WR'), spot('TE'), spot('TE'), spot('RB'), spot('RB')], BENCH)
    expect(empty.usedIds).not.toEqual(heavy.usedIds)
    expect([...heavy.usedIds]).toContain('te2')
    expect([...empty.usedIds]).toContain('wr4')
  })

  it('keeps each spot with the player who was given it', () => {
    const { filled } = fillSlots([spot('WR', 5, 30), spot('WR', 45, 30)], BENCH)
    expect(filled[0].spot.x).toBe(5)
    expect(filled[1].spot.x).toBe(45)
  })

  it('⚠️ FILLS IN THE PLAY’S ORDER, NOT THE ROSTER’S', () => {
    // Sorting the slots first would quietly reassign who runs which route — a different play from
    // the one that was recommended.
    const { filled } = fillSlots([spot('TE'), spot('WR')], BENCH)
    expect(filled.map(f => f.player.position)).toEqual(['TE', 'WR'])
  })

  it('reports a slot it could not fill rather than dropping it quietly', () => {
    // A play with ten men is not the play; the caller has to be able to tell.
    const thin = [p('wr1', 'WR', 80)]
    const { filled, unfilled } = fillSlots([spot('WR'), spot('WR'), spot('TE')], thin)
    expect(filled).toHaveLength(1)
    expect(unfilled).toHaveLength(2)
  })

  it('handles an empty bench without throwing', () => {
    const { filled, unfilled } = fillSlots([spot('WR')], [])
    expect(filled).toEqual([])
    expect(unfilled).toHaveLength(1)
  })

  it('does not mutate the bench it was handed', () => {
    const order = BENCH.map(x => x.id)
    fillSlots([spot('WR'), spot('TE')], BENCH)
    expect(BENCH.map(x => x.id)).toEqual(order)
  })
})
