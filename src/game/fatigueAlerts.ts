// ── Fatigue on the field without the Fatigue view ([fatigue alerts]) ─────────
//
// Requested: "when a player enters the yellow for the first time, show their and only their fatigue
// bar on the field for one snap. When they enter the red, permanently show their fatigue bar until
// they are no longer in the red" — before the snap only, never during the play — "and if they get
// taken off the field, show the bar in the player inventory until it's in the green." The Fatigue
// toggle still shows everyone; this is what shows when it is off.
//
// "One snap" is keyed to the server's play serial, which changes exactly when the next play is set
// up — so the bar covers the line-up and the play that follows, and is gone at the next line-up
// however many game_state refreshes arrive in between.

// The same bands the bar itself is painted in (renderer drawFatigueBar: >60% green, >30% yellow).
export const YELLOW_AT = 60
export const RED_AT = 30

export interface FatigueAlerts {
  seenYellow: Set<string>          // has been in the yellow at least once this game
  flash: Map<string, number>       // id -> the play serial his one-snap bar belongs to
}

export function createFatigueAlerts(): FatigueAlerts {
  return { seenYellow: new Set(), flash: new Map() }
}

// Fold in a fresh stamina snapshot (sent with each game_state).
export function noteFatigue(alerts: FatigueAlerts, fatigue: Record<string, number>, serial: number) {
  for (const [id, stamina] of Object.entries(fatigue)) {
    if (stamina <= YELLOW_AT && !alerts.seenYellow.has(id)) {
      alerts.seenYellow.add(id)
      alerts.flash.set(id, serial)
    }
  }
}

// The stamina of just the players whose bar should be on the field right now.
export function alertedFatigue(alerts: FatigueAlerts, fatigue: Record<string, number>, serial: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, stamina] of Object.entries(fatigue)) {
    if (stamina <= RED_AT || alerts.flash.get(id) === serial) out[id] = stamina
  }
  return out
}

// Benched players still tired: everyone in the yellow or red. The cards only list players who are off
// the field, so this is exactly "taken off the field, until back in the green".
export function benchStamina(fatigue: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, stamina] of Object.entries(fatigue)) if (stamina <= YELLOW_AT) out[id] = stamina
  return out
}
