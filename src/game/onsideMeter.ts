// [onside] The receiving team's meter: the field-goal block bar turned inside out. Half-widths from the center,
// mirroring the server's ONSIDE_METER, which is what actually judges the tap. "Green should take up 75% of the
// meter, yellow 20% and red 5%", and "the white line moves much, much faster": five times the block bar's.
export const ONSIDE_GREEN_HALF  = 0.375
export const ONSIDE_YELLOW_HALF = 0.475
export const ONSIDE_SWEEP_HALF_SECONDS = 0.1

export function onsideTrackBackground(): string {
  const pct = (v: number) => `${v * 100}%`
  return `linear-gradient(to right,
  #ef4444 0% ${pct(0.5 - ONSIDE_YELLOW_HALF)},
  #facc15 ${pct(0.5 - ONSIDE_YELLOW_HALF)} ${pct(0.5 - ONSIDE_GREEN_HALF)},
  #22c55e ${pct(0.5 - ONSIDE_GREEN_HALF)} ${pct(0.5 + ONSIDE_GREEN_HALF)},
  #facc15 ${pct(0.5 + ONSIDE_GREEN_HALF)} ${pct(0.5 + ONSIDE_YELLOW_HALF)},
  #ef4444 ${pct(0.5 + ONSIDE_YELLOW_HALF)} 100%)`
}
