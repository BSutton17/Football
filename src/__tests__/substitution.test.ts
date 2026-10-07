import { describe, it, expect } from 'vitest'
import { pickSubstitute, moveKey } from '../game/substitution'
import { fillSlots } from '../game/loadPlay'
import type { RosterPlayer } from '../types/player'

const p = (id: string, position: string, ovr: number): RosterPlayer =>
  ({ id, name: id, position, ovr, ratings: {} } as RosterPlayer)
const ROSTER = [p('s1', 'S', 90), p('s2', 'S', 84), p('s3', 'S', 78), p('s4', 'S', 70), p('wr1', 'WR', 92)]

// [fatigue subs] "Swap with the next highest available player at their position; if there is no one
// else available, do nothing."
describe('who comes on', () => {
  it('the best available at his position', () => {
    expect(pickSubstitute('S', ROSTER, new Set(['s1', 's2']))?.id).toBe('s3')
  })

  it('nobody left at the position means nothing happens', () => {
    expect(pickSubstitute('S', ROSTER, new Set(['s1', 's2', 's3', 's4']))).toBeNull()
  })

  it('a fresh man before a tired one, even a better-rated tired one', () => {
    expect(pickSubstitute('S', ROSTER, new Set(['s1', 's2']), { s3: 40 })?.id).toBe('s4')
  })

  it('the job moves with the spot', () => {
    expect(moveKey({ s1: 'deep', s2: 'hook' }, 's1', 's3')).toEqual({ s3: 'deep', s2: 'hook' })
    const same = { s2: 'hook' }
    expect(moveKey(same, 's1', 's3')).toBe(same)       // nothing to move: untouched
  })
})

// ⚠️ Reported: "shells and plays are forcing players back on ... clicking a new play or shell subs them
// back in. It should be based on the players in on the last play."
describe('PLAYS and SHELLS fill from last play, not from the best overall', () => {
  const spots = [{ label: 'S', x: 20, y: 50 }, { label: 'S', x: 33, y: 50 }]

  it("keeps last play's safeties on, even when a better one is resting", () => {
    const { filled } = fillSlots(spots, ROSTER, { onField: new Set(['s2', 's3']), resting: new Set(['s1']) })
    expect(filled.map(f => f.player.id).sort()).toEqual(['s2', 's3'])
  })

  it('needs one more than were out there: the bench first, a resting player only if nobody else', () => {
    const three = [...spots, { label: 'S', x: 26, y: 55 }]
    const { filled } = fillSlots(three, ROSTER, { onField: new Set(['s2', 's3']), resting: new Set(['s1']) })
    expect(filled.map(f => f.player.id).sort()).toEqual(['s2', 's3', 's4'])
    const four = [...three, { label: 'S', x: 26, y: 60 }]
    const all = fillSlots(four, ROSTER, { onField: new Set(['s2', 's3']), resting: new Set(['s1']) })
    expect(all.filled.map(f => f.player.id)).toContain('s1')
  })

  it('with nothing to go on (the first snap) it is still the best available', () => {
    const { filled } = fillSlots(spots, ROSTER)
    expect(filled.map(f => f.player.id)).toEqual(['s1', 's2'])
  })
})
