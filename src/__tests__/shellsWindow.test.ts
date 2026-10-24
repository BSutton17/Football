import { describe, it, expect } from 'vitest'
import { shellsWindowOpen } from '../game/shellsWindow.ts'

describe('[shells window] SHELLS stays available into the countdown', () => {
  it('is open pre-snap', () => {
    expect(shellsWindowOpen('pre_snap', null)).toBe(true)
  })

  it('⚠️ STAYS OPEN ONCE THE OFFENSE SETS — it used to vanish here', () => {
    expect(shellsWindowOpen('countdown', 8)).toBe(true)
    expect(shellsWindowOpen('countdown', 4)).toBe(true)
  })

  it('closes with 3 seconds left in the countdown', () => {
    expect(shellsWindowOpen('countdown', 3)).toBe(false)
    expect(shellsWindowOpen('countdown', 1)).toBe(false)
    expect(shellsWindowOpen('countdown', 0)).toBe(false)
  })

  it('is open in a countdown whose first tick has not arrived yet', () => {
    expect(shellsWindowOpen('countdown', null)).toBe(true)
  })

  it('is closed once the ball is live or dead', () => {
    expect(shellsWindowOpen('live', null)).toBe(false)
    expect(shellsWindowOpen('dead', 5)).toBe(false)
  })
})
