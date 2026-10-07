// ── "2nd & 6" ([down & distance]) ────────────────────────────────────────────
//
// ONE way to say the down and distance, so the HUD and the PLAYS/SHELLS header can never disagree.
// The distance is a spot, not a whole number — 6.79 yards — so it is TRUNCATED for display
// ("2nd & 6"), reads "inches" under a yard, and "Goal" when the line to gain is the goal line.
// Requested after the shortlist header showed "2nd & 6.793738438".

const SUFFIX = ['', 'st', 'nd', 'rd', 'th'] as const

export function ordinalDown(down: number): string {
  return `${down}${SUFFIX[down] ?? 'th'}`
}

export function distanceLabel(distance: number, yardLine?: number): string {
  if (yardLine != null && yardLine + distance >= 100) return 'Goal'
  if (distance < 1) return 'inches'
  return String(Math.floor(distance))
}

export function downAndDistance(down: number, distance: number, yardLine?: number): string {
  return `${ordinalDown(down)} & ${distanceLabel(distance, yardLine)}`
}
