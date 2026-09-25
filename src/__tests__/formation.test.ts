import { describe, it, expect } from 'vitest'
import { validateOffensiveFormation, validateDefensiveFormation } from '../game/formation'
import type { PositionUpdate } from '../types/game'

const YARD_LINE = 40

// [formation] Live legality feedback. App.tsx calls these on every render while players are being
// placed, so an incomplete formation is not an error state — it is the normal state, and the
// message is the instruction for what to do next.
//
// ⚠️ THESE TESTS USED TO ASSERT THE OPPOSITE: that an empty formation produced NO errors. That
// contract has not existed in any commit that ever touched formation.ts — the "place N more"
// branch is there in all of them — so the tests had been failing since the first commit and were
// pinning a rule the code never had. Rewritten against what the function actually promises.

const at = (id: string, x: number, y: number, label: string): PositionUpdate =>
  ({ id, x, y, team: 'o', label })

// Five skill players, all legal: three on the line, a back in the backfield.
const legalFive: PositionUpdate[] = [
  at('WR1', 10, YARD_LINE, 'WR'),
  at('WR2', 20, YARD_LINE, 'WR'),
  at('WR3', 43, YARD_LINE, 'WR'),
  at('TE1', 33, YARD_LINE, 'TE'),
  at('RB1', 24, YARD_LINE - 6, 'RB'),
]

describe('validateOffensiveFormation', () => {
  it('asks for the players that are still missing, and says how many', () => {
    // This is not a failure — it is what the UI shows while you are still placing.
    expect(validateOffensiveFormation([], 5, YARD_LINE)).toEqual([
      'Place 5 more players before the snap',
    ])
  })

  it('gets the singular right for the last one', () => {
    expect(validateOffensiveFormation(legalFive.slice(0, 4), 5, YARD_LINE)).toEqual([
      'Place 1 more player before the snap',
    ])
  })

  it('passes a complete, legal formation', () => {
    expect(validateOffensiveFormation(legalFive, 5, YARD_LINE)).toEqual([])
  })

  it('⚠️ REQUIRES SEVEN ON THE LINE — the five linemen plus two more', () => {
    // An NFL rule the engine enforces: with everyone off the line it is an illegal formation.
    const allBackfield = legalFive.map(p => ({ ...p, y: YARD_LINE - 5 }))
    expect(validateOffensiveFormation(allBackfield, 5, YARD_LINE).join(' '))
      .toMatch(/at least 2 more players on the line/)
  })

  it('⚠️ ALLOWS AT MOST FOUR IN THE BACKFIELD, counting the quarterback', () => {
    const crowded = legalFive.map((p, i) => ({ ...p, y: i < 4 ? YARD_LINE - 5 : YARD_LINE }))
    expect(validateOffensiveFormation(crowded, 5, YARD_LINE).join(' '))
      .toMatch(/Too many players in the backfield/)
  })

  it('counts a player within a yard and a half of the line as ON it', () => {
    // The threshold is deliberately loose: a receiver does not have to be exactly on the line to
    // be on it, and requiring that would make a legal formation feel impossible to place.
    const justOff = legalFive.map(p => (p.label === 'RB' ? p : { ...p, y: YARD_LINE - 1 }))
    expect(validateOffensiveFormation(justOff, 5, YARD_LINE)).toEqual([])
  })
})

describe('validateDefensiveFormation', () => {
  it('asks for the players that are still missing', () => {
    expect(validateDefensiveFormation([], 7)).toEqual([
      'Place 7 more players before the snap',
    ])
  })

  it('passes once they are all out there', () => {
    // ⚠️ There are no illegal formations on defense — it may line up however it likes, so the only
    // thing to check is that everybody is on the field.
    const seven = Array.from({ length: 7 }, (_, i) => at(`D${i}`, 10 + i * 4, YARD_LINE + 5, 'LB'))
    expect(validateDefensiveFormation(seven, 7)).toEqual([])
  })

  it('does not complain when MORE than required are placed', () => {
    const eight = Array.from({ length: 8 }, (_, i) => at(`D${i}`, 10 + i * 4, YARD_LINE + 5, 'LB'))
    expect(validateDefensiveFormation(eight, 7)).toEqual([])
  })
})
