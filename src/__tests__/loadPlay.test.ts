import { describe, it, expect } from 'vitest'
import { fillSlots } from '../game/loadPlay'
import type { RosterPlayer } from '../types/player'
import { enforceOffensiveFormation, validateOffensiveFormation } from '../game/formation'

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

describe('⚠️ A LOADED PLAY MUST BE LEGAL ON ARRIVAL', () => {
  // Loading placed the eleven straight onto the field and skipped `enforceOffensiveFormation`,
  // which every manual drag goes through. Some authored formations therefore appeared already
  // flagged illegal — and the player could not fix it, because they had not placed anybody.
  const LOS = 40

  it('passes the same validator a dragged formation has to pass', () => {
    // Everyone off the line, which is what trips the "2 more on the line of scrimmage" error.
    const offLine = [
      spot('WR', 4, LOS - 3), spot('WR', 48, LOS - 3), spot('WR', 34, LOS - 4),
      spot('TE', 20, LOS - 3), spot('RB', 26, LOS - 6),
    ]
    const { filled } = fillSlots(offLine, BENCH)
    const raw = filled.map(f => ({
      id: f.player.id, x: f.spot.x, y: f.spot.y, team: 'o' as const, label: f.player.position,
    }))

    // Unenforced, this is the state the bug shipped.
    expect(validateOffensiveFormation(raw, raw.length, LOS).length).toBeGreaterThan(0)

    // Enforced, the way a dragged formation arrives.
    const enforced = enforceOffensiveFormation(raw, LOS)
    expect(validateOffensiveFormation(enforced, enforced.length, LOS)).toEqual([])
  })

  it('leaves an already-legal formation alone', () => {
    const legal = [
      spot('WR', 4, LOS), spot('WR', 48, LOS), spot('WR', 34, LOS),
      spot('TE', 20, LOS), spot('RB', 26, LOS - 6),
    ]
    const { filled } = fillSlots(legal, BENCH)
    const raw = filled.map(f => ({
      id: f.player.id, x: f.spot.x, y: f.spot.y, team: 'o' as const, label: f.player.position,
    }))
    const enforced = enforceOffensiveFormation(raw, LOS)
    expect(validateOffensiveFormation(enforced, enforced.length, LOS)).toEqual([])
    // and the receivers stay where the play drew them
    expect(enforced.find(p => p.id === raw[0].id)!.x).toBeCloseTo(raw[0].x, 5)
  })
})

describe('⚠️ MAN COVERAGE GETS THE RIGHT BODY', () => {
  // The shell says which SPOT covers a receiver; it cannot know the offense would come out in four
  // wides. Filling strictly by the drawn label put a linebacker on a slot receiver in Cover 1 while
  // the corners stood on tight ends — and the computer running the same shell did it correctly.
  const DEF: RosterPlayer[] = [
    p('cb1', 'CB', 88), p('cb2', 'CB', 84), p('cb3', 'CB', 79),
    p('s1', 'S', 86), p('s2', 'S', 80),
    p('lb1', 'LB', 85), p('lb2', 'LB', 81),
  ]

  it('puts a corner on a spot the server says needs one, even when drawn as a linebacker', () => {
    const { filled } = fillSlots([{ label: 'LB', x: 20, y: 44, prefer: ['CB', 'S', 'LB'] }], DEF)
    expect(filled[0].player.position).toBe('CB')
  })

  it('falls back to the drawn position when the preferred ones are gone', () => {
    const noCorners = DEF.filter(x => x.position !== 'CB' && x.position !== 'S')
    const { filled } = fillSlots([{ label: 'LB', x: 20, y: 44, prefer: ['CB', 'S', 'LB'] }], noCorners)
    expect(filled[0].player.position).toBe('LB')
  })

  it('leaves a spot with no preference filling by its drawn position', () => {
    const { filled } = fillSlots([{ label: 'LB', x: 20, y: 44 }], DEF)
    expect(filled[0].player.position).toBe('LB')
  })

  it('still never double-books a player across spots', () => {
    const { filled, usedIds } = fillSlots([
      { label: 'LB', x: 10, y: 44, prefer: ['CB'] },
      { label: 'LB', x: 20, y: 44, prefer: ['CB'] },
      { label: 'CB', x: 30, y: 44 },
    ], DEF)
    expect(usedIds.size).toBe(3)
    expect(new Set(filled.map(f => f.player.id)).size).toBe(3)
  })
})
