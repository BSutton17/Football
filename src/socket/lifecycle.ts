// ── Leaving the app and coming back ([quick leave]) ────────────────────────
//
// "Ensure the game survives quick leaves like swiping up and answering a text or leaving the app for a
// few moments."
//
// A phone does not close an app it backgrounds, it stops running it. Three things follow, and this
// file is the answer to each:
//
//   • THE SERVER DOES NOT KNOW YOU LEFT. The socket stays nominally open until a ping goes unanswered,
//     fifteen seconds later, and the computer plays on in that time. So say so on the way out.
//   • THE SOCKET MAY BE DEAD WHEN YOU RETURN, while still reporting itself connected, until the same
//     fifteen seconds pass on this side. After more than a moment away, do not wait to find out:
//     reconnect at once. The server takes the old connection over (see `reconnect`).
//   • NOTHING WAKES THE RECONNECT LOOP. It is on timers, and timers were frozen too.
//
// Hidden-pause is solo-always, but online only on a touch device: on a desktop, switching tabs for a
// moment during someone else's turn is ordinary and should not stop their game.

import { socket, SESSION_KEY } from './index.ts'
import { pingServer } from './keepAwake.ts'
import { gameStore } from '../utils/gameStore.ts'

// Away for longer than this and the connection is assumed dead rather than tested.
const ASSUME_DEAD_AFTER_MS = 3000

let hiddenAt = 0
let solo = false

// Whether the game this client is in has a computer in the other seat. App.tsx keeps this current.
export function setLifecycleSolo(isSolo: boolean): void { solo = isSolo }

function isTouchDevice(): boolean {
  return typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0
}

function inGame(): boolean {
  return !!gameStore.getItem(SESSION_KEY)
}

function onLeave(): void {
  if (hiddenAt) return   // pagehide and visibilitychange both fire on the way out
  hiddenAt = Date.now()
  if (inGame() && socket.connected && (solo || isTouchDevice())) socket.emit('app_hidden')
}

function onReturn(): void {
  const away = hiddenAt ? Date.now() - hiddenAt : 0
  hiddenAt = 0
  if (!inGame()) return
  pingServer()   // an eco dyno may have gone to sleep while we were gone; wake it now

  if (!socket.connected) {
    socket.connect()
  } else if (away > ASSUME_DEAD_AFTER_MS) {
    // Closing the transport (not the socket) keeps socket.io's own reconnect behaviour, and the
    // `connect` handler re-presents the session token. That lifts the hold on the server.
    socket.io.engine?.close()
  } else {
    socket.emit('app_visible')
  }
}

// ── Keeping the screen on ────────────────────────────────────────────────
//
// A phone left alone for its auto-lock time goes to sleep, and reading a coverage for thirty seconds
// looks exactly like being left alone. Only while a game is on screen, and let go otherwise. Not every
// phone offers it, and on older iPhones a home-screen app is refused: then it is just not available.
let wakeWanted = false
let wakeLock: { release: () => Promise<void> } | null = null

async function takeWakeLock(): Promise<void> {
  if (!wakeWanted || wakeLock || document.visibilityState !== 'visible') return
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void>; addEventListener: (e: string, f: () => void) => void }> } }
    const lock = await nav.wakeLock?.request('screen')
    if (!lock) return
    wakeLock = lock
    // The system drops it whenever the app is hidden. installLifecycle asks again on the way back.
    lock.addEventListener('release', () => { wakeLock = null })
  } catch { /* refused: the phone simply sleeps on its usual schedule */ }
}

export function keepScreenOn(on: boolean): void {
  wakeWanted = on
  if (on) void takeWakeLock()
  else { void wakeLock?.release().catch(() => {}); wakeLock = null }
}

let installed = false

export function installLifecycle(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onLeave()
    else { onReturn(); void takeWakeLock() }
  })
  // iOS sometimes skips visibilitychange on the way out of an app, but not pagehide.
  window.addEventListener('pagehide', onLeave)
  // A page restored whole from the back/forward cache fires neither of the above on the way back.
  window.addEventListener('pageshow', (e) => { if (e.persisted) onReturn() })
  // The network coming back is a reason to try right now rather than on the next backoff tick.
  window.addEventListener('online', () => { if (inGame() && !socket.connected) socket.connect() })
}
