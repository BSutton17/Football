import type { PlayPhase } from '../types/game.ts'

// [pause soft-lock] Whether a `game_state` resync should clear the hike gate.
//
// ⚠️ `hikeReady` IS DERIVED FROM A ONE-SHOT EVENT. The server schedules the countdown's ticks up
// front and the last one — `hike_countdown { count: 0 }` — is what unlocks the snap. It fires
// exactly once. So any full state resync that clears the flag while the countdown is still the
// current phase loses it forever: the tick has already been and gone, the phase stays COUNTDOWN,
// and the HIKE button is disabled with nothing left that can ever re-enable it. The game is stuck
// with no way forward.
//
// A resync arrives on reconnect, which is what a paused game on a phone does the moment the socket
// drops — "if your game pauses when you are ready to play but haven't snapped, it softlocks you."
// Pausing is just the easiest way to hit it; any dropped connection during a countdown does the
// same.
//
// A new play always begins in PRE_SNAP, so a resync that still says COUNTDOWN is describing the
// play already in progress and must not reset it.
export function shouldClearHikeGate(incomingPhase: PlayPhase): boolean {
  return incomingPhase !== 'countdown'
}
