// [dev flags] Taking an auto-placed defensive lineman off the field, in dev builds only.
//
// The four down linemen are generated on the client (getDLPlayers) rather than placed by hand, so
// nothing in the ordinary UI can remove one: the remove button refuses every `auto_` id, because in a
// real game removing the quarterback or a guard would be a broken formation, not a choice.
//
// Being able to take a lineman off is worth having while working on the AI: it is how you check a
// three-man front, or clear the ends out of the way to see what the coverage behind them is actually
// doing.
//
// ⚠️ DOWN LINEMEN ONLY, AND NEVER THE OFFENSE'S AUTO PLAYERS. The offense's line and quarterback
// reach the server inside the locked `set_offense` payload, not as placements — so removing one here
// would desync the two sides rather than remove anybody, and a play with no passer is not a scenario,
// it is a crash waiting to happen.

/** Is this an auto-placed player a dev build is allowed to remove? */
export function canRemoveAutoPlayer(id: string | null | undefined): boolean {
  if (!import.meta.env.DEV) return false
  if (!id) return false
  return id.startsWith('auto_dl')
}

/** Is this an auto-placed player at all? (The ids the ordinary UI refuses.) */
export function isAutoPlayer(id: string | null | undefined): boolean {
  return !!id && id.startsWith('auto_')
}

// ⚠️ A REMOVAL HAS TO SURVIVE THE PLAY BOUNDARY OR THE FEATURE IS USELESS. The DL row is
// regenerated from scratch at every new play, on a turnover, and on reconnect — five separate places.
// Without this the lineman is back twenty-five seconds later, which is no good at all for looking at
// alignment across a series of downs, the exact thing it exists for.
//
// Kept as a set of removed ids rather than a count, because WHICH lineman was taken off matters: the
// two ends and the two interior men sit in different places and do different jobs.
export function withoutRemoved<T extends { id: string }>(
  row: T[],
  removed: ReadonlySet<string>,
): T[] {
  if (!import.meta.env.DEV || removed.size === 0) return row
  return row.filter(p => !removed.has(p.id))
}
