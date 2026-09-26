// [authored] What the server offers when the player asks the AI what it would call.
//
// ⚠️ THE SERVER HAS NO ROSTER — player data lives here on the client. So a recommendation arrives
// as the SHAPE of the play, a spot and a route per slot in field coordinates, and this side fills
// each slot from its own bench. That split is what makes substitution work with no new protocol:
// the client already knows who its best available receiver is.

import type { RouteOffset } from '../game/routeDraw.ts'

export interface PlaySpot {
  slot: string            // 'WR1', 'TE1', … — stable across formations, not a player
  label: 'WR' | 'TE' | 'RB'
  x: number               // yards, already resolved against the ball's hash
  y: number
  // A blocker carries NO route rather than an empty one: the engine reads "has a drawn route" as
  // "is running it", so an empty array would send him nowhere at full speed.
  route: RouteOffset[] | null
  blocking: boolean
}

export interface PlayLayout {
  id: string
  name: string
  playType: 'pass' | 'run' | 'rpo'
  formationId: string
  formationName: string
  spots: PlaySpot[]
}

export interface OfferedPlay {
  id: string
  name: string
  formationId: string
  formationName: string
  playType: 'pass' | 'run' | 'rpo'
  depth: number
  score: number
  why: string
  layout: PlayLayout
}

export interface ShellSpot {
  slot: string
  label: 'DL' | 'LB' | 'CB' | 'S'
  x: number
  y: number
  job: 'man' | 'zone' | 'rush' | 'spy'
  zone: string | null
  // A zone centre is ALWAYS a number by the time it reaches here: a null centre had the whole
  // assignment refused, which left that defender with no job — and the engine rushes anyone it has
  // no job for, so one unlandmarked zone quietly became a free rusher and an empty hook.
  zoneCenterX: number | null
  zoneCenterY: number | null
  covers: string | null   // the receiver's real id, so the client can assign man coverage directly
  shade: string
  // Who should fill this spot, best first — see SlotRequest.prefer in game/loadPlay.ts.
  prefer?: string[]
}

export interface ShellLayout {
  id: string
  name: string
  kind: 'zone' | 'man' | 'blitz'
  formationId: string
  formationName: string
  spots: ShellSpot[]
}

export interface OfferedShell {
  id: string
  name: string
  kind: 'zone' | 'man' | 'blitz'
  formationId: string
  formationName: string
  rushers: number
  score: number
  why: string
  layout: ShellLayout
}

export interface PlaysOffered {
  situation: { down: number; distance: number; yardLine: number }
  plays: OfferedPlay[]
}

export interface ShellsOffered {
  situation: { down: number; distance: number; yardLine: number }
  look: { id: string; wr: number; te: number; rb: number }
  shells: OfferedShell[]
}
