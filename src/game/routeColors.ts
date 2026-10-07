// ── Route colours ([route colours]) ──────────────────────────────────────────
//
// Authored plays mark routes red or blue in the sandbox (red: the primary reads; blue: the back's
// route, and a few tight ends). The marking is art: it is shown on the PLAYS cards, on the field
// once a play is loaded, and in the manual-mode route art while a play is frozen. The engine never
// reads it.

export type RouteColor = 'red' | 'blue'

export const ROUTE_COLOR_HEX: Record<RouteColor, string> = { red: '#ef4444', blue: '#3b82f6' }

// What a route's colour becomes when the player changes that route (draws a new one, picks one from
// the list, sends him to block). Requested: "if a RB has a blue route and receives a new route it
// should stay blue; however if a WR, TE or RB have a red route, it should turn yellow when changed."
// Blue is a marking of the PLAYER's job (the back's release), so it survives a new route; red marks a
// specific read, which a new route is no longer, so it goes back to the normal yellow (no colour).
export function colorAfterChange(prev: RouteColor | null | undefined): RouteColor | null {
  return prev === 'blue' ? 'blue' : null
}

// Hex colours for the renderer, from the per-player markings.
export function routeColorHex(colors: Record<string, RouteColor>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [id, c] of Object.entries(colors)) out[id] = ROUTE_COLOR_HEX[c]
  return out
}
