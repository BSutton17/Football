import { describe, it, expect } from 'vitest'
import { shouldClearHikeGate, shouldClearOpponentFormation } from '../game/resync'

// ⚠️ THE SOFT-LOCK. `hikeReady` is unlocked by a one-shot `hike_countdown { count: 0 }`. A full
// state resync arrives on reconnect — which is exactly what a paused game on a phone does when the
// socket drops — and it used to clear the gate unconditionally. The tick had already fired, the
// phase was still COUNTDOWN, and the HIKE button was disabled with nothing left that could ever
// re-enable it.

describe('clearing the hike gate on a state resync', () => {
  it('⚠️ LEAVES IT ALONE MID-COUNTDOWN — the unlock tick will never come again', () => {
    expect(shouldClearHikeGate('countdown')).toBe(false)
  })

  it('clears it on a new play, which always begins pre-snap', () => {
    expect(shouldClearHikeGate('pre_snap')).toBe(true)
  })

  it('clears it once the ball is live or dead', () => {
    expect(shouldClearHikeGate('live')).toBe(true)
    expect(shouldClearHikeGate('dead')).toBe(true)
  })
})

// ⚠️ "PAUSING AND UNPAUSING MAKES THE OTHER TEAM'S PLAYERS INVISIBLE BUT STILL THERE."
//
// `game_state` wipes the opponent's formation, which is right at a whistle — the server clears both
// player maps, so anything still drawn is a ghost, and a computer opponent picks a fresh formation
// with fresh ids every play, so without the wipe the other team grows by a receiver a play.
//
// It is destructive on a RESEND, and the pause repair resends on every resume. Nothing re-places the
// other team afterwards: a human has finished placing their eleven and will not touch them again, and
// the computer only realigns when the picture changes.
//
// The first fix keyed on the PHASE, which cannot work — a resend during pre-snap is indistinguishable
// from the start of a play, so the bug survived for the case that was actually reported. `playSerial`
// is the real discriminator: the server bumps it once per play.

const NEW_PLAY = 7
const SAME_PLAY = 7

describe('clearing the opponent formation on a resync', () => {
  it('⚠️ KEEPS THEM ON SCREEN MID-PLAY', () => {
    expect(shouldClearOpponentFormation('countdown', SAME_PLAY, SAME_PLAY)).toBe(false)
    expect(shouldClearOpponentFormation('live', SAME_PLAY, SAME_PLAY)).toBe(false)
    // …even if a serial somehow advanced mid-play, the phase settles it.
    expect(shouldClearOpponentFormation('live', 9, 7)).toBe(false)
  })

  it('⚠️ KEEPS THEM ON SCREEN THROUGH A PRE-SNAP RESEND — the reported bug', () => {
    // A pause and resume during pre-snap: same play, same situation, so the eleven men already drawn
    // still belong there. This is the case the phase-only rule got wrong.
    expect(shouldClearOpponentFormation('pre_snap', SAME_PLAY, SAME_PLAY)).toBe(false)
  })

  it('still clears when the play really has advanced', () => {
    // Otherwise the computer's fresh formation stacks on the old one: twelve men, then thirteen.
    expect(shouldClearOpponentFormation('pre_snap', NEW_PLAY + 1, NEW_PLAY)).toBe(true)
    expect(shouldClearOpponentFormation('dead', NEW_PLAY + 1, NEW_PLAY)).toBe(true)
  })

  it('clears on the first state of the game, when there is no serial to compare', () => {
    expect(shouldClearOpponentFormation('pre_snap', 0, null)).toBe(true)
    expect(shouldClearOpponentFormation('pre_snap', 0, undefined)).toBe(true)
  })

  it('⚠️ FALLS BACK TO THE PHASE RULE WITH NO SERIAL AT ALL', () => {
    // A server that sends no playSerial must not end up never clearing — that is the thirteen-man
    // formation, which is a worse bug than the one being fixed here.
    expect(shouldClearOpponentFormation('pre_snap', null, null)).toBe(true)
    expect(shouldClearOpponentFormation('pre_snap')).toBe(true)
    expect(shouldClearOpponentFormation('live')).toBe(false)
  })

  it('a serial that went BACKWARDS is still a different play', () => {
    // Nothing should send one, but "different" is the honest test, not "greater" — a stale number is
    // a reason to redraw, not a reason to trust what is on screen.
    expect(shouldClearOpponentFormation('pre_snap', 3, 9)).toBe(true)
  })
})
