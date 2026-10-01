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

  it("discourages iOS Safari's gestures, which the viewport tag does not", () => {
    // iOS has ignored user-scalable and maximum-scale since iOS 10; these events are the real lever.
    expect(lock).toContain('gesturestart')
    // preventDefault on a passive listener is ignored, so it has to opt out.
    expect(lock).toContain('passive: false')
  })

  // ⚠️ THE BLOCK MUST NOT APPLY WHILE ALREADY ZOOMED. The first version refused every
  // multi-finger touch, which also refused the pinch-OUT -- it removed the only way back and the
  // player was trapped a second time. Gestures are only stopped at 1x now.
  it('never blocks a gesture that could be zooming back OUT', () => {
    expect(lock).toContain('stopIfUnzoomed')
    expect(lock).toMatch(/scale\(\) <= AT_ONE_X/)
    // and no blanket multi-touch refusal
    expect(lock).not.toMatch(/touches\.length > 1/)
  })

  // ⚠️ AND THERE IS AN ESCAPE THAT DOES NOT DEPEND ON WINNING. Rewriting the viewport meta does
  // NOT undo a user zoom on iOS, so the first version's "recovery" could never have fired. A reload
  // does clear it, and sessionStorage carries the game across one.
  it('offers a way out when the page is zoomed anyway', () => {
    expect(lock).toContain('Reset view')
    expect(lock).toContain('location.reload')
    // positioned inside the VISIBLE rectangle: a fixed element can be off-screen while zoomed
    expect(lock).toContain('offsetLeft')
    expect(lock).toContain('visualViewport')
  })
})
