// ── Surviving a zoom on a phone ([mobile]) ──────────────────────────────────
//
// Reported three times, and the first two fixes were wrong in instructive ways:
//
//   1. PREVENT IT. `touch-action: none` and `maximum-scale` were already set and iOS Safari ignores
//      both — it drives pinch through its own `gesture*` events, above that layer.
//   2. BLOCK MULTI-TOUCH AND REWRITE THE VIEWPORT TO RECOVER. Blocking two fingers also blocked the
//      pinch-OUT, removing the escape; and rewriting the viewport meta does not undo a user zoom on
//      iOS, so the recovery never fired.
//   3. RELOAD TO RESET. "Reset view works for a second then it forces me back into the zoomed in
//      view" — iOS RESTORES the previous zoom on reload, so the reset is undone a moment later.
//
// The pattern is that the browser wins every fight over page scale. So this stops fighting: the app
// FOLLOWS the visual viewport instead. When the page is zoomed, the root element is sized and offset
// to the rectangle actually on screen, so the whole UI re-lays-out into the visible area and the
// game stays playable at any scale. A zoom becomes a nuisance rather than a trap.
//
// The pinch-out still works (nothing blocks it), and the Reset view button is kept as a convenience
// — but nothing depends on it succeeding any more.

const ZOOMED = 1.02

let escapeEl: HTMLButtonElement | null = null

function vv(): VisualViewport | null {
  return window.visualViewport ?? null
}

// ⚠️ THE ROOT FOLLOWS THE VISIBLE RECTANGLE. While iOS is zoomed, CSS `100%` still means the LAYOUT
// viewport, which is bigger than what the player can see — so the HUD and the field run off the
// edges and the controls become unreachable. Pinning #root to visualViewport's rect puts everything
// back on screen at whatever scale the browser has chosen.
function follow(): void {
  const v = vv()
  const root = document.getElementById('root')
  if (!v || !root) return
  if (v.scale <= ZOOMED) {
    root.style.removeProperty('position')
    root.style.removeProperty('width')
    root.style.removeProperty('height')
    root.style.removeProperty('left')
    root.style.removeProperty('top')
    return
  }
  root.style.position = 'fixed'
  root.style.left = `${v.offsetLeft}px`
  root.style.top = `${v.offsetTop}px`
  root.style.width = `${v.width}px`
  root.style.height = `${v.height}px`
}

function placeEscape(el: HTMLButtonElement): void {
  const v = vv()
  if (!v) return
  el.style.left = `${v.offsetLeft + 10}px`
  el.style.top = `${v.offsetTop + 10}px`
  el.style.transform = `scale(${1 / Math.max(1, v.scale)})`
  el.style.transformOrigin = 'top left'
}

function ensureEscape(): HTMLButtonElement {
  if (escapeEl) return escapeEl
  const el = document.createElement('button')
  el.type = 'button'
  el.textContent = 'Reset view'
  el.setAttribute('aria-label', 'Reset the zoom')
  Object.assign(el.style, {
    position: 'fixed', zIndex: '2147483647', display: 'none',
    padding: '10px 16px', borderRadius: '8px', border: '2px solid #fff',
    background: '#c8102e', color: '#fff', font: '700 15px system-ui, sans-serif',
    boxShadow: '0 2px 10px rgba(0,0,0,0.5)', touchAction: 'manipulation',
  } as Partial<CSSStyleDeclaration>)
  // A reload DOES clear the scale on Android, and on iOS the zoom is usually restored — which is
  // why the layout above is what actually saves the session. sessionStorage carries the game across
  // it either way, so the game is never lost by pressing this.
  el.addEventListener('click', () => window.location.reload())
  document.body.appendChild(el)
  escapeEl = el
  return el
}

export function lockZoom(): () => void {
  // ⚠️ GESTURES ARE ONLY BLOCKED AT 1x. Blocking one that is trying to zoom OUT is what trapped the
  // player the second time.
  const stopIfUnzoomed = (e: Event) => { if ((vv()?.scale ?? 1) <= ZOOMED) e.preventDefault() }
  const opts: AddEventListenerOptions = { passive: false }
  document.addEventListener('gesturestart', stopIfUnzoomed, opts)
  document.addEventListener('gesturechange', stopIfUnzoomed, opts)

  const sync = () => {
    follow()
    const zoomed = (vv()?.scale ?? 1) > ZOOMED
    const el = zoomed ? ensureEscape() : escapeEl
    if (!el) return
    el.style.display = zoomed ? 'block' : 'none'
    if (zoomed) placeEscape(el)
  }

  const v = vv()
  v?.addEventListener('resize', sync)
  v?.addEventListener('scroll', sync)
  window.addEventListener('orientationchange', sync)
  sync()

  return () => {
    document.removeEventListener('gesturestart', stopIfUnzoomed, opts)
    document.removeEventListener('gesturechange', stopIfUnzoomed, opts)
    v?.removeEventListener('resize', sync)
    v?.removeEventListener('scroll', sync)
    window.removeEventListener('orientationchange', sync)
    escapeEl?.remove()
    escapeEl = null
    const root = document.getElementById('root')
    if (root) { root.style.cssText = '' }
  }
}
