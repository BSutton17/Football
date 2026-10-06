// [authored] Filling an authored play's slots from this team's bench.
//
// ⚠️ THIS IS WHERE SUBSTITUTION HAPPENS, AND IT HAPPENS HERE BECAUSE THE SERVER HAS NO ROSTER.
// Player data lives on the client, so a recommendation arrives as slots — WR1, TE1, RB1 — and the
// server has no idea who those are. An empty set and a heavy formation want different people, and
// asking for the best available at each position IS the personnel change. Nothing else has to know
// a substitution occurred.

import type { RosterPlayer } from '../types/player.ts'
import type { RouteOffset } from './routeDraw.ts'

export interface SlotRequest {
  label: string       // 'WR' | 'TE' | 'RB' on offense; 'CB' | 'S' | 'LB' on defense
  x: number
  y: number
  // ⚠️ WHO SHOULD ACTUALLY FILL THIS SPOT, best first, when the drawn position is not the right
  // body. A man assignment needs someone who can run with its target — a corner on a receiver —
  // and the shell cannot know the offense would come out in four wides. The server works this out
  // (it knows the assignment and the target) and sends it; this side has the roster.
  //
  // Without it a loaded Cover 1 put a linebacker on a slot receiver while the corners stood on
  // tight ends, and the computer running the SAME shell did it correctly.
  prefer?: string[]
}

export interface FilledSlot<T extends SlotRequest> {
  spot: T
  player: RosterPlayer
}

export interface FillResult<T extends SlotRequest> {
  filled: FilledSlot<T>[]
  // Who is now on the field, so the caller can take everyone else off. A formation that keeps last
  // play's receivers standing around is a formation of more than eleven.
  usedIds: Set<string>
  // Slots nobody could fill — a four-receiver set on a roster with three healthy wideouts. Reported
  // rather than silently dropped, because the difference matters: a play missing a receiver is a
  // play with ten men, not a play.
  unfilled: T[]
}

// Best available at each position, in the order the play asks for them.
//
// ⚠️ THE ORDER IS THE PLAY'S, NOT THE ROSTER'S. Slots are filled as the play lists them, so the
// first WR slot gets the best receiver. Sorting the slots first would quietly reassign who runs
// which route, which is a different play from the one that was recommended.
export function fillSlots<T extends SlotRequest>(spots: T[], bench: RosterPlayer[]): FillResult<T> {
  const ranked = [...bench].sort((a, b) => (b.ovr ?? 0) - (a.ovr ?? 0))
  const usedIds = new Set<string>()
  const filled: FilledSlot<T>[] = []
  const unfilled: T[] = []

  for (const spot of spots) {
    // The server's preference first, then the drawn position as the last resort.
    let player: RosterPlayer | undefined
    for (const want of [...(spot.prefer ?? []), spot.label]) {
      player = ranked.find(p => p.position === want && !usedIds.has(p.id))
      if (player) break
    }
    if (!player) { unfilled.push(spot); continue }
    usedIds.add(player.id)
    filled.push({ spot, player })
  }

  return { filled, usedIds, unfilled }
}

// What each filled slot is told to do: a drawn route, or BLOCK.
//
// ⚠️ A BLOCKER IS PUT IN TO BLOCK — having no route is not the same thing. The server marks a
// blocking spot `blocking` and sends no route for him; reading only the route left every authored
// blocker standing in the game, unassigned, until the player double-tapped him by hand.
export function assignmentsFor(
  filled: FilledSlot<SlotRequest & { route?: RouteOffset[] | null; blocking?: boolean }>[],
): { routes: Record<string, RouteOffset[]>; blocks: Record<string, 'block'> } {
  const routes: Record<string, RouteOffset[]> = {}
  const blocks: Record<string, 'block'> = {}
  for (const { spot, player } of filled) {
    if (spot.blocking) blocks[player.id] = 'block'
    // A blocker carries NO route rather than an empty one — the engine reads "has a drawn route"
    // as "is running it", so an empty array would send him nowhere at full speed.
    else if (spot.route && spot.route.length) routes[player.id] = spot.route
  }
  return { routes, blocks }
}
