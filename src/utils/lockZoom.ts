// ── Zoom on a phone: out is allowed, in is not ([mobile]) ───────────────────
//
// Reported four times. The history matters because each attempt failed for a different reason:
//
//   1. PREVENT IT with CSS and the viewport tag — iOS ignores `maximum-scale` and `user-scalable`
//      and drives pinch through its own `gesture*` events, above the level `touch-action` works at.
//   2. BLOCK MULTI-TOUCH — also blocked the pinch-OUT, removing the only escape.
//   3. REWRITE THE VIEWPORT META TO RECOVER — does not undo a user zoom on iOS; never fired.
//   4. RELOAD TO RECOVER — "hitting reset view forces me back into the zoomed in mode". iOS RESTORES
//      the zoom level for a page across a reload, so the reset undid itself a moment later.
//
// The player's own diagnosis is the design here: "we just need the game to allow two finger zooming
// out but not zooming in". So the decision is made from the GESTURE'S DIRECTION rather than from the
// page scale — `gesturechange` carries `scale`, which is relative to the start of that gesture:
// above 1 the fingers are spreading (zooming in, refused), below 1 they are closing (zooming out,
// always allowed, at any scale).
//
// Earlier versions gated on the PAGE scale instead, which is a different thing and the reason a
// pinch-out could still be swallowed.
//
// ⚠️ AND THE ESCAPE IS A FRESH NAVIGATION, NOT A RELOAD. Safari remembers zoom per page and restores
// it on reload; a different URL is a different page for that purpose, so a cache-busting query is
// what actually comes back at 1x. sessionStorage survives it, so the game is not lost.
//
// The visual-viewport layout following stays underneath all of it: if a zoom does happen, the UI
// re-lays-out into the visible rectangle so the game remains playable rather than becoming a trap.

const ZOOMED = 1.02

let escapeEl: HTMLButtonElement | null = null

function vv(): VisualViewport | null {
  return window.visualViewport ?? null
}

function scale(): number {
  return vv()?.scale ?? 1
}

// ⚠️ CSS `100%` MEANS THE LAYOUT VIEWPORT, NOT THE VISIBLE ONE. That is why a zoom was a trap: at 2x
// the HUD and field keep their full layout size, run off the edges, and the controls become
// unreachable. Pinning #root to the visible rectangle puts everything back on screen at any scale.
function follow(): void {
  const v = vv()
  const root = document.getElementById('root')
  if (!v || !root) return
  if (v.scale <= ZOOMED) {
    for (const prop of ['position', 'width', 'height', 'left', 'top']) root.style.removeProperty(prop)
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

// A fresh URL, not a reload: Safari restores the zoom for the same page.
function resetByNavigation(): void {
  const url = new URL(window.location.href)
  url.searchParams.set('v', Date.now().toString(36))
  window.location.replace(url.toString())
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
  el.addEventListener('click', resetByNavigation)
  document.body.appendChild(el)
  escapeEl = el
  return el
}

// iOS gesture events carry a `scale` relative to the start of the gesture. The DOM lib does not
// describe them, so the shape is declared narrowly here rather than reaching for `any`.
type GestureLike = Event & { scale?: number }

export function lockZoom(): () => void {
  const opts: AddEventListenerOptions = { passive: false }

  // At 1x a gesture can only be zooming IN, so it is refused outright. While already zoomed the
  // direction is unknown until `gesturechange` reports it, so the gesture is allowed to begin —
  // refusing it here is what trapped the player before.
  const onStart = (e: Event) => { if (scale() <= ZOOMED) e.preventDefault() }

  // The actual rule: spreading is refused, closing is always allowed.
  const onChange = (e: Event) => {
    const g = e as GestureLike
    if (typeof g.scale !== 'number') return
    if (g.scale > 1) e.preventDefault()        // fingers spreading — zooming in
    // g.scale <= 1 is a pinch out; never interfered with, at any page scale.
  }

  document.addEventListener('gesturestart', onStart, opts)
  document.addEventListener('gesturechange', onChange, opts)

  const sync = () => {
    follow()
    const zoomed = scale() > ZOOMED
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
    document.removeEventListener('gesturestart', onStart, opts)
    document.removeEventListener('gesturechange', onChange, opts)
    v?.removeEventListener('resize', sync)
    v?.removeEventListener('scroll', sync)
    window.removeEventListener('orientationchange', sync)
    escapeEl?.remove()
    escapeEl = null
    const root = document.getElementById('root')
    if (root) root.style.cssText = ''
  }
}
