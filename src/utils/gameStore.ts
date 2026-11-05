// ── Where a game in progress is remembered ([quick leave]) ─────────────────
//
// ⚠️ A HOME-SCREEN APP AND A BROWSER TAB HAVE OPPOSITE NEEDS, so this picks per launch.
//
//   • In a BROWSER, sessionStorage is right: each tab is its own seat, and two tabs on one computer
//     (how a two-player game gets tested) must not fight over one session token.
//   • In a HOME-SCREEN APP there is only ever one window, and iOS relaunches it from scratch whenever
//     it needs the memory back -- with an EMPTY sessionStorage. Swipe away to answer a text, come back
//     to a relaunch, and the token to the game still waiting on the server was gone.
//
// Everything that remembers the game goes through here rather than choosing for itself.

type StoreLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches
}

function backing(): StoreLike | null {
  try {
    if (typeof window === 'undefined') return null
    return isStandalone() ? window.localStorage : window.sessionStorage
  } catch {
    return null   // storage can be walled off entirely in some private modes; a game still runs
  }
}

export const gameStore: StoreLike = {
  getItem(key) {
    try { return backing()?.getItem(key) ?? null } catch { return null }
  },
  setItem(key, value) {
    try { backing()?.setItem(key, value) } catch { /* full or blocked: nothing to be done mid-game */ }
  },
  removeItem(key) {
    try { backing()?.removeItem(key) } catch { /* as above */ }
  },
}
