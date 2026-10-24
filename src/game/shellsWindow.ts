// [shells window] When the defense may open SHELLS.
//
// Pre-snap, always. After the offense sets, the countdown is the defense's adjust window — the server
// accepts placements and coverage throughout it — so the button stays until 3 seconds are left:
// "It should remain available until 3 seconds before the countdown is over."
//
// `hikeCount` is the server's `hike_countdown`: whole seconds left, one tick per second down to 0.
// Null during a countdown means no tick has arrived yet (a reconnect mid-countdown); the window is
// treated as open, because the server still takes the placements and the next tick closes it if it
// should be closed.
export const SHELLS_CLOSE_AT_SECONDS = 3

export function shellsWindowOpen(phase: string, hikeCount: number | null): boolean {
  if (phase === 'pre_snap') return true
  if (phase !== 'countdown') return false
  return hikeCount === null || hikeCount > SHELLS_CLOSE_AT_SECONDS
}
