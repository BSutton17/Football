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

// ⚠️ A RESYNC IS NOT A NEW PLAY, AND THE PHASE CANNOT TELL YOU WHICH IT IS.
//
// `game_state` wipes the opponent's formation, and that is right at a whistle: the server clears
// both player maps, so anything still on screen is a ghost. A computer opponent also picks a FRESH
// formation every play with different ids, so without the wipe the other team grows by a receiver a
// play — twelve men, then thirteen.
//
// It is wrong on a RESEND. The pause repair re-broadcasts state, and so does a reconnect. Nothing
// re-places the other team afterwards: a human opponent has already placed their eleven and will not
// touch them again, and the computer only realigns when the picture CHANGES. So the other team
// simply vanishes and stays vanished — "pausing and unpausing makes the other team's players
// invisible but still there".
//
// This used to be decided from the phase alone, which cannot work: a resend during pre-snap looks
// exactly like the start of a play. `playSerial` is what actually distinguishes them — the server
// bumps it once per play, and the AI already reads it the same way (`k.newPlay = serial !== last`).
// Same serial means the same pre-snap situation, so whatever is on screen still belongs there.
export function shouldClearOpponentFormation(
  incomingPhase: PlayPhase,
  incomingSerial?: number | null,
  lastSerial?: number | null,
): boolean {
  // Mid-play is never the start of a play, whatever the serials say.
  if (incomingPhase === 'countdown' || incomingPhase === 'live') return false

  // No serial to compare (an older server, or the very first state of the game) — fall back to the
  // phase rule. Clearing when there is nothing there yet is harmless; NOT clearing when a serial is
  // missing would bring back the thirteen-man formation.
  if (incomingSerial == null || lastSerial == null) return true

  return incomingSerial !== lastSerial
}
