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

// ⚠️ A RESYNC MID-PLAY IS NOT A NEW PLAY. `game_state` wipes the opponent's formation, and that is
// right at a whistle: the server clears both player maps, so anything still on screen is a ghost.
//
// It is wrong while a play is running. A resync arrives on reconnect and whenever the server
// resends state — the pause repair does exactly that — and mid-play nothing re-places the other
// team, so they simply vanish and stay vanished for the rest of the down. "After pausing and
// unpausing the game the opponent's players are sometimes invisible."
//
// A new play always begins in PRE_SNAP, and during pre-snap both sides re-send their formations
// anyway, so wiping there is both correct and self-healing.
export function shouldClearOpponentFormation(incomingPhase: PlayPhase): boolean {
  return incomingPhase !== 'countdown' && incomingPhase !== 'live'
}
