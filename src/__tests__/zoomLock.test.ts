import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ⚠️ A PLAYER HAD TO QUIT A GAME OVER THIS.
//
// Reported: "on mobile when I two finger tap it zooms me in and I can't zoom out so I'm forced to
// quit the game." There is nothing to zoom into — it is a game, not a document — and being stuck
// zoomed-in mid-match makes the field unreadable with no way back.
//
// Checked at the SOURCE, the way hookOrder.test.ts is, because the real regression is editorial:
// somebody loosens the viewport to debug something on a phone, or drops the call from main. None of
// that fails a type-check, a build, or any other test, and it cannot be caught in Node without a
// DOM. The three things below are what make it work, and each of them was missing at some point.

const read = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8')

describe('the page cannot be zoomed on a phone', () => {
  const html = read('index.html')
  const viewport = /<meta name="viewport"[^>]*content="([^"]+)"/.exec(html)?.[1] ?? ''

  it('the viewport does not invite scaling', () => {
    expect(viewport).toContain('user-scalable=no')
    expect(viewport).toContain('maximum-scale=1.0')
    // ⚠️ minimum-scale was 0.5, which permits the page to be scaled at all.
    expect(viewport).toContain('minimum-scale=1.0')
  })

  it('is installed before React renders', () => {
    const main = read('src/main.tsx')
    expect(main).toContain('lockZoom')
    // Called, not merely imported.
    expect(/^lockZoom\(\)/m.test(main)).toBe(true)
  })

  const lock = read('src/utils/lockZoom.ts')

  it("blocks iOS Safari's own gestures, which the viewport tag does not", () => {
    // iOS has ignored user-scalable and maximum-scale since iOS 10; these events are the real lever.
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
      expect(lock).toContain(ev)
    }
    // preventDefault on a passive listener is ignored, so it has to opt out.
    expect(lock).toContain('passive: false')
  })

  it('and can put the scale back if one gets through', () => {
    // Prevention that leaks still traps somebody, so there is a recovery path.
    expect(lock).toContain('visualViewport')
    expect(lock).toContain('resetScale')
  })
})
