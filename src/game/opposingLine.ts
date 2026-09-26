import type { PositionUpdate } from '../types/game.ts'

// [frozen DL] Which defensive linemen to draw.
//
// ⚠️ THE LOCAL FOUR ARE A PLACEHOLDER, NOT THE TRUTH. Every client generates four linemen locally
// (`getDLPlayers`) so the field looks right before the defense has placed anything, and the
// offense's view used to draw all four, substituting the server's position for any it had heard
// about. That is fine while the defense fields four.
//
// It is not fine when it fields three. An authored 3-4 or 3-3-5 has the AI remove the surplus
// lineman, and the server then never sends a position for somebody who no longer exists — so the
// offense kept drawing him at his local default, motionless, for the whole play. A frozen DL,
// seen only from the offense, and only against a three-down front.
//
// Once the other side has placed ANY linemen, its set is the whole truth: three means three.
export function opposingLine(
  localLine: PositionUpdate[],
  opponentPositions: PositionUpdate[],
): PositionUpdate[] {
  const theirs = opponentPositions.filter(p => p.id.startsWith('auto_dl'))
  return theirs.length > 0 ? theirs : localLine
}
