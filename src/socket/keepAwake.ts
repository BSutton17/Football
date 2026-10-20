import { SERVER_URL } from './index.ts'

// ── Keeping the server awake during a game ([keep awake]) ────────────────────
//
// The server runs on a Heroku eco dyno, which goes to sleep after 30 minutes without an HTTP request.
// The game itself talks over a WebSocket, and socket traffic does NOT count — so a game that ran past
// half an hour simply ended when the dyno slept. Requested: "while a game is being played, ping the
// server every 10 minutes."
//
// `no-cors` because the ping only has to ARRIVE: the response is never read, so the server needs no
// CORS headers for it, and an opaque response is fine.

export const KEEP_AWAKE_MS = 10 * 60 * 1000

export function pingServer(): void {
  try {
    void fetch(`${SERVER_URL}/ping`, { cache: 'no-store', mode: 'no-cors', keepalive: true }).catch(() => {})
  } catch { /* never let a keep-awake ping break the game */ }
}

// Starts pinging (once now, then every 10 minutes); returns the function that stops it.
export function startKeepAwake(intervalMs = KEEP_AWAKE_MS): () => void {
  pingServer()
  const id = setInterval(pingServer, intervalMs)
  return () => clearInterval(id)
}
