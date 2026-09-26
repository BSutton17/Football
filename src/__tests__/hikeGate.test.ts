import { describe, it, expect } from 'vitest'
import { shouldClearHikeGate } from '../game/hikeGate'

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
