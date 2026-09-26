import { describe, it, expect } from 'vitest'
import { opposingLine } from '../game/opposingLine'
import type { PositionUpdate } from '../types/game'

// ⚠️ "THERE'S A FROZEN DL … WHEN I WAS ON OFFENSE AGAINST THE AI."
//
// Every client generates four linemen locally so the field looks right before the defense has
// placed anything, and the offense drew all four, substituting the server's position for any it
// had heard about. Against an authored 3-4 or 3-3-5 the AI removes the surplus lineman — and the
// server never sends a position for somebody who no longer exists — so the offense kept drawing
// him at his local default, motionless, all play.

const dl = (n: number, x: number): PositionUpdate =>
  ({ id: `auto_dl${n}`, x, y: 41, team: 'd', label: 'DL' })
const LOCAL = [dl(1, 20), dl(2, 24), dl(3, 28), dl(4, 32)]

describe('which defensive line to draw', () => {
  it('⚠️ DRAWS THREE WHEN THE DEFENSE FIELDS THREE', () => {
    const theirs = [dl(1, 10), dl(2, 13), dl(3, 16)]
    const shown = opposingLine(LOCAL, theirs)
    expect(shown).toHaveLength(3)
    expect(shown.map(p => p.id)).not.toContain('auto_dl4')
  })

  it('falls back to the local four before the defense has placed anything', () => {
    expect(opposingLine(LOCAL, [])).toHaveLength(4)
  })

  it('uses the local four when the opponent has sent only skill players', () => {
    // On defense the opponent is an OFFENSE, so nothing there is a lineman and our own four stand.
    const offense = [{ id: 'wr1', x: 5, y: 40, team: 'o' as const, label: 'WR' }]
    expect(opposingLine(LOCAL, offense)).toHaveLength(4)
  })

  it('takes the opponent’s positions, not our placeholder ones', () => {
    const theirs = [dl(1, 10), dl(2, 13), dl(3, 16), dl(4, 19)]
    expect(opposingLine(LOCAL, theirs).map(p => p.x)).toEqual([10, 13, 16, 19])
  })

  it('handles a front that grows back to four', () => {
    expect(opposingLine(LOCAL, [dl(1, 10), dl(2, 13), dl(3, 16), dl(4, 19)])).toHaveLength(4)
  })
})
