// ── Getting back to 1× on a phone ([mobile]) ────────────────────────────────
//
// Reported twice: "on mobile when I two finger tap it zooms me in and I can't zoom out so I'm
// forced to quit the game." The first attempt at this tried to PREVENT the zoom. It did not work,
// and worse, two things about it actively made the trap harder to escape:
//
//   ⚠️ BLOCKING MULTI-TOUCH BLOCKED THE WAY OUT. Refusing every two-finger touch also refuses the
//     pinch-OUT that would have taken the player back to 1x. The guard removed the escape.
//
//   ⚠️ REWRITING THE VIEWPORT META DOES NOT UNDO A USER ZOOM ON iOS. It works on some Android
//     browsers, which is why the trick is widely repeated, and Safari ignores it once a person has
//     pinched. The "recovery" could never have fired.
//
// So this stops trying to win that fight. It assumes the player WILL get zoomed and makes sure
// there is always a way back:
//
//   1. gestures are only blocked while the page is AT 1x, so zooming in is discouraged and zooming
//      back out is never prevented
//   2. a RESET VIEW button appears whenever the page is zoomed, positioned inside the visible
//      rectangle so it cannot be off-screen, and reloading is what actually clears the scale
//
// ⚠️ RELOADING DOES NOT LOSE THE GAME. The session token lives in sessionStorage and survives a
// reload in the same tab, so the client rejoins the game in progress and restores its formation.
// That is the only reason this is an acceptable escape hatch rather than a forfeit.

const ZOOMED = 1.05          // above this, treat the page as zoomed and offer the way out
const AT_ONE_X = 1.01        // at or below this, the page is effectively unzoomed

let escapeEl: HTMLButtonElement | null = null

function scale(): number {
  return window.visualViewport?.scale ?? 1
}

// The button has to sit in the VISIBLE rectangle, not the layout one: while iOS is zoomed,
// `position: fixed` is relative to the layout viewport, so a corner-pinned element is frequently
// scrolled off the part of the screen the player can actually see.
function placeEscape(el: HTMLButtonElement): void {
  const vv = window.visualViewport
  if (!vv) return
  const pad = 10
  el.style.left = `${vv.offsetLeft + pad}px`
  el.style.top = `${vv.offsetTop + pad}px`
  // Scale the control up as the page zooms in, so it stays a comfortable size on screen rather
  // than growing with the zoom.
  el.style.transform = `scale(${1 / Math.max(1, vv.scale)})`
  el.style.transformOrigin = 'top left'
}

function ensureEscape(): HTMLButtonElement {
  if (escapeEl) return escapeEl
  const el = document.createElement('button')
  el.type = 'button'
  el.textContent = 'Reset view'
  el.setAttribute('aria-label', 'Reset the zoom and rejoin the game')
  Object.assign(el.style, {
    position: 'fixed', zIndex: '2147483647', display: 'none',
    padding: '10px 16px', borderRadius: '8px', border: '2px solid #fff',
    background: '#c8102e', color: '#fff', font: '700 15px system-ui, sans-serif',
    boxShadow: '0 2px 10px rgba(0,0,0,0.5)', touchAction: 'manipulation',
  } as Partial<CSSStyleDeclaration>)
  // Reloading is what clears the scale; sessionStorage carries the game across it.
  el.addEventListener('click', () => window.location.reload())
  document.body.appendChild(el)
  escapeEl = el
  return el
}

export function lockZoom(): () => void {
  // The viewport tag is left discouraging zoom, but nothing depends on it being obeyed.
  const tag = document.querySelector('meta[name="viewport"]')
  const previous = tag?.getAttribute('content') ?? null

  // ⚠️ ONLY WHILE AT 1x. Blocking a gesture that is trying to zoom OUT is what trapped the player.
  const stopIfUnzoomed = (e: Event) => { if (scale() <= AT_ONE_X) e.preventDefault() }
  const opts: AddEventListenerOptions = { passive: false }
  document.addEventListener('gesturestart', stopIfUnzoomed, opts)
  document.addEventListener('gesturechange', stopIfUnzoomed, opts)

  const sync = () => {
    const zoomed = scale() > ZOOMED
    const el = zoomed ? ensureEscape() : escapeEl
    if (!el) return
    el.style.display = zoomed ? 'block' : 'none'
    if (zoomed) placeEscape(el)
  }

  const vv = window.visualViewport
  vv?.addEventListener('resize', sync)
  vv?.addEventListener('scroll', sync)     // panning while zoomed moves the visible rectangle
  window.addEventListener('orientationchange', sync)
  sync()

  return () => {
    document.removeEventListener('gesturestart', stopIfUnzoomed, opts)
    document.removeEventListener('gesturechange', stopIfUnzoomed, opts)
    vv?.removeEventListener('resize', sync)
    vv?.removeEventListener('scroll', sync)
    window.removeEventListener('orientationchange', sync)
    escapeEl?.remove()
    escapeEl = null
    if (previous != null) tag?.setAttribute('content', previous)
  }
}
