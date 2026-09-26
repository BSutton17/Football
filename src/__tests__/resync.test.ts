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

// ⚠️ "AFTER PAUSING AND UNPAUSING THE GAME THE OPPONENT'S PLAYERS ARE SOMETIMES INVISIBLE."
//
// `game_state` wipes the opponent's formation, which is right at a whistle — the server clears
// both player maps, so anything still drawn is a ghost. Mid-play it is destructive: nothing
// re-places the other team until the next snap, so they vanish for the rest of the down. The
// pause repair resends state on every resume, which is how a pause started doing it.

describe('clearing the opponent formation on a resync', () => {
  it('⚠️ KEEPS THEM ON SCREEN MID-PLAY', () => {
    expect(shouldClearOpponentFormation('countdown')).toBe(false)
    expect(shouldClearOpponentFormation('live')).toBe(false)
  })

  it('clears at a new play, which always begins pre-snap', () => {
    expect(shouldClearOpponentFormation('pre_snap')).toBe(true)
  })

  it('clears once the ball is dead', () => {
    expect(shouldClearOpponentFormation('dead')).toBe(true)
  })
})
