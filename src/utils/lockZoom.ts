// ── Keeping the page at 1× on a phone ([mobile]) ────────────────────────────
//
// Reported: "on mobile when I two finger tap it zooms me in and I can't zoom out so I'm forced to
// quit the game." Being trapped zoomed-in mid-game is worse than almost any gameplay bug — the
// field is unreadable and there is no way back, so the only exit is abandoning the match.
//
// ⚠️ `touch-action: none` AND `maximum-scale` ARE NOT ENOUGH, AND BOTH WERE ALREADY SET. iOS
// Safari has ignored `maximum-scale` and `user-scalable=no` since iOS 10, and it drives pinch and
// two-finger zoom through its own `gesture*` events, above the level `touch-action` operates at.
// The CSS stops the page SCROLLING; it does not stop Safari SCALING.
//
// So this does three things, in order of how much they are needed:
//   1. blocks the iOS gesture events, which is what actually prevents the zoom
//   2. blocks a multi-finger touch from starting one at all
//   3. ⚠️ and RECOVERS if the page is zoomed anyway, because prevention that leaks still traps
//      somebody. Rewriting the viewport meta forces the browser back to 1× — the one lever that
//      works from script once a scale has been applied.

const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'

function viewportTag(): HTMLMetaElement | null {
  return document.querySelector('meta[name="viewport"]')
}

// Force the browser back to 1×. Toggling the content is what makes it re-read the tag; setting the
// same string it already has does nothing, so it goes via a throwaway value first.
function resetScale(): void {
  const tag = viewportTag()
  if (!tag) return
  tag.setAttribute('content', VIEWPORT_LOCKED + ', shrink-to-fit=yes')
  // A frame later, back to the real one. Same-tick changes are coalesced and ignored.
  requestAnimationFrame(() => tag.setAttribute('content', VIEWPORT_LOCKED))
}

export function lockZoom(): () => void {
  const tag = viewportTag()
  const previous = tag?.getAttribute('content') ?? null
  tag?.setAttribute('content', VIEWPORT_LOCKED)

  const stop = (e: Event) => e.preventDefault()

  // 1. iOS Safari's own pinch/two-finger gestures. Non-passive or preventDefault is ignored.
  const opts: AddEventListenerOptions = { passive: false }
  document.addEventListener('gesturestart', stop, opts)
  document.addEventListener('gesturechange', stop, opts)
  document.addEventListener('gestureend', stop, opts)

  // 2. A second finger landing is never a game input — the whole UI is single-touch.
  const onTouch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault() }
  document.addEventListener('touchstart', onTouch, opts)
  document.addEventListener('touchmove', onTouch, opts)

  // 3. The safety net. If a scale got through anyway — a browser that honours none of the above,
  // or a gesture that began before this ran — put it back rather than leaving somebody stuck.
  const vv = window.visualViewport
  const onScale = () => { if (vv && vv.scale > 1.01) resetScale() }
  vv?.addEventListener('resize', onScale)
  // Rotating the device re-lays-out at whatever scale is current, which is the other way a zoom
  // becomes permanent.
  window.addEventListener('orientationchange', onScale)

  return () => {
    document.removeEventListener('gesturestart', stop, opts)
    document.removeEventListener('gesturechange', stop, opts)
    document.removeEventListener('gestureend', stop, opts)
    document.removeEventListener('touchstart', onTouch, opts)
    document.removeEventListener('touchmove', onTouch, opts)
    vv?.removeEventListener('resize', onScale)
    window.removeEventListener('orientationchange', onScale)
    if (previous != null) tag?.setAttribute('content', previous)
  }
}
